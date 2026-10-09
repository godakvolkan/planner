import * as React from 'react'
import { CalendarRange, GraduationCap, MapPin, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { FixedEvent } from '../../../shared/types'
import { addDays, isoWeekday, today, weekStart } from '../../../shared/dates'
import { busyMinutes, eventsOn, toMinutes } from '../../../shared/schedule'
import { Page, EmptyState } from '@/components/common/Page'
import { Toggle } from '@/components/common/Toggle'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp } from '@/lib/app-context'
import { refreshAll, useNow } from '@/lib/data'
import { formatMinutes } from '@/lib/format'
import { areaColor, findArea } from '@/lib/areas'
import { cn } from '@/lib/utils'

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const HOUR_PX = 48

const input =
  'h-9 w-full rounded-lg border bg-background/50 px-3 text-[13px] outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20'

interface Draft {
  id: number | null
  title: string
  location: string
  areaId: number | null
  weekdays: number[]
  startTime: string
  endTime: string
  validFrom: string
  validTo: string
  countsAgainstCapacity: boolean
}

const emptyDraft = (weekday = isoWeekday(today()), start = '09:00'): Draft => ({
  id: null,
  title: '',
  location: '',
  areaId: null,
  weekdays: [weekday],
  startTime: start,
  endTime: `${String(Math.min(23, Number(start.slice(0, 2)) + 2)).padStart(2, '0')}:${start.slice(3)}`,
  validFrom: '',
  validTo: '',
  countsAgainstCapacity: true
})

function EventDialog({ draft, onClose }: { draft: Draft | null; onClose: () => void }): React.JSX.Element {
  const { areas } = useApp()
  const [d, setD] = React.useState<Draft>(draft ?? emptyDraft())
  React.useEffect(() => {
    if (draft) setD(draft)
  }, [draft])
  const set = <K extends keyof Draft>(k: K, v: Draft[K]): void => setD((p) => ({ ...p, [k]: v }))

  const save = async (): Promise<void> => {
    if (!d.title.trim()) return void toast.error('Ders adını yaz.')
    if (d.startTime >= d.endTime) return void toast.error('Bitiş saati başlangıçtan sonra olmalı.')
    if (!d.weekdays.length) return void toast.error('En az bir gün seç.')
    const common = {
      title: d.title.trim(),
      location: d.location.trim() || null,
      areaId: d.areaId,
      startTime: d.startTime,
      endTime: d.endTime,
      validFrom: d.validFrom || null,
      validTo: d.validTo || null,
      countsAgainstCapacity: d.countsAgainstCapacity
    }
    try {
      if (d.id) {
        await window.api.events.update(d.id, { ...common, weekday: d.weekdays[0] })
        toast.success('Ders güncellendi')
      } else {
        const created = await window.api.events.create({ ...common, weekdays: d.weekdays })
        toast.success(created.length > 1 ? `${created.length} güne eklendi` : 'Ders eklendi')
      }
      refreshAll()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message.replace(/^.*Error: /, '') : 'Kaydedilemedi.')
    }
  }

  const remove = async (): Promise<void> => {
    if (!d.id) return
    try {
      await window.api.events.delete(d.id)
      refreshAll()
      onClose()
      toast('Ders silindi', { description: d.title })
    } catch {
      toast.error('Silinemedi.')
    }
  }

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" /> {d.id ? 'Dersi düzenle' : 'Ders ekle'}
          </DialogTitle>
          <DialogDescription>Haftalık tekrar eder; o saatler kapasiteden düşülür ve hatırlatma gelir.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <input autoFocus className={cn(input, 'h-10 text-[14px] font-medium')} placeholder="Ders adı, örn. Veri Yapıları" value={d.title} onChange={(e) => set('title', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[12px] text-muted-foreground">
              Yer
              <input className={cn(input, 'mt-1')} placeholder="örn. B-204, Lab-3" value={d.location} onChange={(e) => set('location', e.target.value)} />
            </label>
            <label className="text-[12px] text-muted-foreground">
              Alan
              <Select value={d.areaId ? String(d.areaId) : 'none'} onValueChange={(v) => set('areaId', v === 'none' ? null : Number(v))}>
                <SelectTrigger className="mt-1 h-9 w-full">
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
            </label>
          </div>
          <div>
            <div className="mb-1 text-[12px] text-muted-foreground">{d.id ? 'Gün' : 'Günler (birden fazla seçebilirsin)'}</div>
            <div className="flex gap-1">
              {SHORT.map((label, i) => {
                const day = i + 1
                const on = d.weekdays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => set('weekdays', d.id ? [day] : on ? d.weekdays.filter((x) => x !== day) : [...d.weekdays, day])}
                    className={cn(
                      'h-9 flex-1 rounded-lg border text-[12.5px] font-medium transition-colors',
                      on ? 'border-ring/50 bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[12px] text-muted-foreground">
              Başlangıç
              <input type="time" className={cn(input, 'mt-1')} value={d.startTime} onChange={(e) => set('startTime', e.target.value)} />
            </label>
            <label className="text-[12px] text-muted-foreground">
              Bitiş
              <input type="time" className={cn(input, 'mt-1')} value={d.endTime} onChange={(e) => set('endTime', e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[12px] text-muted-foreground">
              Dönem başı (isteğe bağlı)
              <input type="date" className={cn(input, 'mt-1')} value={d.validFrom} onChange={(e) => set('validFrom', e.target.value)} />
            </label>
            <label className="text-[12px] text-muted-foreground">
              Dönem sonu (isteğe bağlı)
              <input type="date" className={cn(input, 'mt-1')} value={d.validTo} onChange={(e) => set('validTo', e.target.value)} />
            </label>
          </div>
          <div className="flex items-center justify-between rounded-xl border px-3 py-2.5">
            <div>
              <div className="text-[13px] font-medium">Kapasiteden düş</div>
              <div className="text-[11.5px] text-muted-foreground">Bu saatlerde başka iş planlanamaz sayılır</div>
            </div>
            <Toggle label="Kapasiteden düş" checked={d.countsAgainstCapacity} onChange={(v) => set('countsAgainstCapacity', v)} />
          </div>
        </div>
        <DialogFooter className="items-center">
          {d.id && (
            <Button variant="ghost" className="mr-auto gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={remove}>
              <Trash2 className="size-4" /> Sil
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button className="border-0 bg-brand font-semibold text-white" onClick={save}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Dar pencerede bir gün sütununun en küçük genişliği */
const DAY_MIN_PX = 92
const GRID_COLS = '56px repeat(7, minmax(0, 1fr))'

export function PageSchedule(): React.JSX.Element {
  const { events, areas } = useApp()
  const now = useNow()
  const todayStr = today()
  const todayWd = isoWeekday(todayStr)
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const hasEvents = events.length > 0

  // Izgara yatay kayıyorsa bugünün sütunu görünür olsun
  React.useEffect(() => {
    const box = scrollRef.current
    const col = box?.querySelector<HTMLElement>(`[data-weekday="${todayWd}"]`)
    if (!box || !col || box.scrollWidth <= box.clientWidth) return
    box.scrollLeft = Math.max(0, col.offsetLeft - 56 - (box.clientWidth - 56 - col.offsetWidth) / 2)
  }, [todayWd, hasEvents])

  const starts = events.map((e) => toMinutes(e.startTime))
  const ends = events.map((e) => toMinutes(e.endTime))
  const from = Math.min(8 * 60, ...starts.map((m) => Math.floor(m / 60) * 60))
  const to = Math.max(18 * 60, ...ends.map((m) => Math.ceil(m / 60) * 60))
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => from + i * 60)
  const minute = now.getHours() * 60 + now.getMinutes()
  const weekBusy = DAYS.reduce((sum, _, i) => sum + busyMinutes(events, addDays(weekStart(todayStr), i)), 0)
  const todays = eventsOn(events, todayStr)

  const toDraft = (e: FixedEvent): Draft => ({
    id: e.id,
    title: e.title,
    location: e.location ?? '',
    areaId: e.areaId,
    weekdays: [e.weekday],
    startTime: e.startTime,
    endTime: e.endTime,
    validFrom: e.validFrom ?? '',
    validTo: e.validTo ?? '',
    countsAgainstCapacity: e.countsAgainstCapacity
  })

  return (
    <Page
      wide
      title="Ders programı"
      subtitle={events.length ? `Haftada ${formatMinutes(weekBusy)} ders · bugün ${todays.length} ders` : 'Haftalık sabit programın'}
      className="pb-6"
      actions={
        <Button className="gap-2 border-0 bg-brand font-semibold text-white glow" onClick={() => setDraft(emptyDraft())}>
          <Plus className="size-4" /> Ders ekle
        </Button>
      }
    >
      {events.length === 0 ? (
        <div className="mx-auto max-w-[920px]">
          <EmptyState
            icon={CalendarRange}
            title="Henüz ders eklenmedi."
            description="Derslerini, iş saatlerini veya sabit toplantılarını ekle. Planlayıcıda dolu görünür, kapasiteden düşülür ve başlamadan önce masaüstüne hatırlatma gelir."
            action={
              <Button className="gap-2 border-0 bg-brand text-white" onClick={() => setDraft(emptyDraft())}>
                <Plus className="size-4" /> İlk dersi ekle
              </Button>
            }
          />
        </div>
      ) : (
        <div className="surface flex h-full min-h-0 flex-col overflow-hidden">
          {/* Dar pencerede gün sütunları en az DAY_MIN_PX kalır, ızgara yatay kayar; başlık ve saatler sabit */}
          <div ref={scrollRef} data-hscroll className="min-h-0 flex-1 overflow-auto">
          <div style={{ minWidth: 56 + 7 * DAY_MIN_PX }}>
          <div className="sticky top-0 z-30 grid border-b bg-card" style={{ gridTemplateColumns: GRID_COLS }}>
            <div className="sticky left-0 z-10 bg-card" />
            {DAYS.map((d, i) => (
              <div key={d} className={cn('border-l border-border/60 px-3 py-3', i + 1 === todayWd && 'bg-primary/[0.04]')}>
                <div className={cn('text-[12px] font-semibold', i + 1 === todayWd ? 'text-primary' : 'text-muted-foreground')}>{d}</div>
                <div className="text-[11px] text-muted-foreground">{events.filter((e) => e.weekday === i + 1).length ? `${events.filter((e) => e.weekday === i + 1).length} ders` : 'Boş'}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="grid" style={{ gridTemplateColumns: GRID_COLS }}>
              <div className="sticky left-0 z-20 bg-card">
                {hours.map((h) => (
                  <div key={h} className="relative" style={{ height: HOUR_PX }}>
                    <span className="absolute -top-2 right-2 text-[10.5px] tabular text-muted-foreground">{String(h / 60).padStart(2, '0')}:00</span>
                  </div>
                ))}
              </div>
              {DAYS.map((d, i) => {
                const wd = i + 1
                const dayEvents = events.filter((e) => e.weekday === wd)
                return (
                  <div
                    key={d}
                    data-weekday={wd}
                    className={cn('relative cursor-copy border-l border-border/60', wd === todayWd && 'bg-primary/[0.04]')}
                    style={{ height: hours.length * HOUR_PX }}
                    onDoubleClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const m = from + Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30
                      setDraft(emptyDraft(wd, `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`))
                    }}
                    title="Çift tıkla: bu saate ders ekle"
                  >
                    {hours.map((h, j) => (
                      <div key={h} className="absolute inset-x-0 border-t border-border/50" style={{ top: j * HOUR_PX }} />
                    ))}
                    {dayEvents.map((e) => {
                      const area = findArea(areas, e.areaId)
                      const color = areaColor(area)
                      const s = toMinutes(e.startTime)
                      const en = toMinutes(e.endTime)
                      const live = wd === todayWd && minute >= s && minute < en
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setDraft(toDraft(e))}
                          className={cn(
                            'absolute inset-x-1 overflow-hidden rounded-lg border-l-[3px] px-2 py-1.5 text-left text-[12px] transition-shadow hover:z-10 hover:shadow-lg',
                            live && 'ring-2 ring-ring/60'
                          )}
                          style={{
                            top: ((s - from) / 60) * HOUR_PX + 1,
                            height: ((en - s) / 60) * HOUR_PX - 2,
                            borderLeftColor: color,
                            background: `color-mix(in oklch, ${color} 22%, var(--card))`
                          }}
                        >
                          <div className="truncate font-semibold">{e.title}</div>
                          <div className="truncate text-[11px] tabular text-foreground/70">
                            {e.startTime}–{e.endTime}
                          </div>
                          {e.location && (
                            <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-foreground/70">
                              <MapPin className="size-3 shrink-0" /> {e.location}
                            </div>
                          )}
                          {live && <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-wider text-primary">Şu an</div>}
                        </button>
                      )
                    })}
                    {wd === todayWd && minute >= from && minute <= to && (
                      <div className="pointer-events-none absolute inset-x-0 z-20 h-[2px] bg-brand" style={{ top: ((minute - from) / 60) * HOUR_PX }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          </div>
          </div>
          <div className="border-t px-4 py-2 text-[11.5px] text-muted-foreground">Bir derse tıkla: düzenle · Boş yere çift tıkla: o saate ders ekle</div>
        </div>
      )}
      <EventDialog draft={draft} onClose={() => setDraft(null)} />
    </Page>
  )
}
