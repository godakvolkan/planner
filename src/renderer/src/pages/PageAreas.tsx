import * as React from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Area } from '../../../shared/types'
import { Page, Meter, Section, EmptyState } from '@/components/common/Page'
import { TaskRow } from '@/components/task/TaskRow'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApp } from '@/lib/app-context'
import { refreshAll, useData } from '@/lib/data'
import { formatMinutes } from '@/lib/format'
import { AREA_COLORS, areaColor } from '@/lib/areas'
import { cn } from '@/lib/utils'

const EMOJIS = ['🎓', '💻', '🤖', '🔬', '🚀', '🏠', '📚', '💼', '🏃', '🎨', '🎵', '💰', '🧠', '❤️', '🌱', '✈️', '🛠️', '📝', '🎯', '📊', '🧪', '🗣️', '🎮', '📁']

interface AreaDraft {
  id: number | null
  name: string
  icon: string
  color: string
}

function AreaDialog({ draft, onClose, taskCount }: { draft: AreaDraft | null; onClose: () => void; taskCount: number }): React.JSX.Element {
  const [d, setD] = React.useState<AreaDraft>(draft ?? { id: null, name: '', icon: '📁', color: 'area-1' })
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  React.useEffect(() => {
    if (draft) setD(draft)
    setConfirmDelete(false)
  }, [draft])

  const save = async (): Promise<void> => {
    if (!d.name.trim()) return void toast.error('Alan adını yaz.')
    try {
      if (d.id) await window.api.areas.update(d.id, { name: d.name, icon: d.icon, color: d.color })
      else await window.api.areas.create({ name: d.name, icon: d.icon, color: d.color })
      refreshAll()
      onClose()
      toast.success(d.id ? 'Alan güncellendi' : 'Alan eklendi', { description: `${d.icon} ${d.name.trim()}` })
    } catch (e) {
      toast.error(e instanceof Error && e.message.includes('zaten var') ? 'Bu isimde bir alan zaten var.' : 'Kaydedilemedi.')
    }
  }

  const remove = async (): Promise<void> => {
    if (!d.id) return
    if (!confirmDelete) return setConfirmDelete(true)
    try {
      await window.api.areas.delete(d.id)
      refreshAll()
      onClose()
      toast('Alan silindi', { description: taskCount ? `${taskCount} görev alansız kaldı, silinmedi.` : d.name })
    } catch {
      toast.error('Silinemedi.')
    }
  }

  const preview = `var(--${d.color})`

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{d.id ? 'Alanı düzenle' : 'Yeni alan'}</DialogTitle>
          <DialogDescription>Alanlar hayatının uzun vadeli bölümleridir: okul, iş, proje, kişisel…</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border p-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl text-[24px]" style={{ background: `color-mix(in oklch, ${preview} 22%, transparent)` }}>
            {d.icon}
          </span>
          <input
            autoFocus
            value={d.name}
            onChange={(e) => setD({ ...d, name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Alan adı, örn. Spor"
            maxLength={40}
            className="h-10 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        <div>
          <div className="section-label mb-2">Simge</div>
          <div className="grid grid-cols-8 gap-1.5">
            {EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setD({ ...d, icon: em })}
                className={cn('grid h-9 place-items-center rounded-lg text-[18px] transition-colors hover:bg-accent', d.icon === em && 'bg-primary/15 ring-2 ring-ring/50')}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="section-label mb-2">Renk</div>
          <div className="flex gap-2">
            {AREA_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setD({ ...d, color: c })}
                className={cn('size-8 rounded-full transition-transform hover:scale-110', d.color === c && 'ring-2 ring-foreground/80 ring-offset-2 ring-offset-background')}
                style={{ background: `var(--${c})` }}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="items-center">
          {d.id && (
            <Button variant="ghost" className="mr-auto gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={remove}>
              <Trash2 className="size-4" /> {confirmDelete ? 'Emin misin? Tekrar bas' : 'Sil'}
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

export function PageAreas(): React.JSX.Element {
  const { areas } = useApp()
  const [selected, setSelected] = React.useState<Area | null>(null)
  const [draft, setDraft] = React.useState<AreaDraft | null>(null)
  const all = useData(() => window.api.tasks.list({ view: 'all' })).data ?? []
  const week = useData(() => window.api.stats.week()).data

  const move = async (index: number, dir: -1 | 1): Promise<void> => {
    const ids = areas.map((a) => a.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    try {
      await window.api.areas.reorder(ids)
      refreshAll()
    } catch {
      toast.error('Sıra değiştirilemedi.')
    }
  }

  const editDraft = (a: Area): AreaDraft => ({ id: a.id, name: a.name, icon: a.icon, color: /^area-[1-8]$/.test(a.color) ? a.color : 'area-1' })

  if (selected) {
    const current = areas.find((a) => a.id === selected.id) ?? selected
    const list = all.filter((t) => t.areaId === current.id)
    return (
      <Page
        title={
          <span className="flex items-center gap-3">
            <span className="text-[26px]">{current.icon}</span> {current.name}
          </span>
        }
        subtitle="Alan"
        actions={
          <>
            <Button variant="ghost" className="gap-2" onClick={() => setDraft(editDraft(current))}>
              <Pencil className="size-4" /> Düzenle
            </Button>
            <Button variant="ghost" className="gap-2" onClick={() => setSelected(null)}>
              <ArrowLeft className="size-4" /> Tüm alanlar
            </Button>
          </>
        }
      >
        <Section title="Açık görevler" count={list.length} className="mt-0">
          {list.length === 0 ? (
            <EmptyState icon={LayoutGrid} title="Bu alanda açık görev yok." description={`Hızlı eklemede #${current.name.toLocaleLowerCase('tr-TR')} yazarak bu alana görev ekleyebilirsin.`} />
          ) : (
            <div className="flex flex-col gap-0.5">
              {list.map((t) => (
                <TaskRow key={t.id} task={t} showDate />
              ))}
            </div>
          )}
        </Section>
        <AreaDialog draft={draft} onClose={() => setDraft(null)} taskCount={list.length} />
      </Page>
    )
  }

  return (
    <Page
      title="Alanlar"
      subtitle="Hayatının farklı bölümleri birbirine karışmasın"
      actions={
        <Button className="gap-2 border-0 bg-brand font-semibold text-white glow" onClick={() => setDraft({ id: null, name: '', icon: '📁', color: AREA_COLORS[areas.length % 8] })}>
          <Plus className="size-4" /> Yeni alan
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {areas.map((a, i) => {
          const open = all.filter((t) => t.areaId === a.id)
          const stat = week?.byArea.find((s) => s.areaId === a.id)
          const color = areaColor(a)
          return (
            <div key={a.id} className="surface group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:border-ring/40">
              <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-25 blur-2xl" style={{ background: color }} />
              <div className="absolute right-3 top-3 z-10 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button variant="ghost" size="icon-sm" aria-label="Sola taşı" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ChevronLeft />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Sağa taşı" disabled={i === areas.length - 1} onClick={() => move(i, 1)}>
                  <ChevronRight />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Düzenle" onClick={() => setDraft(editDraft(a))}>
                  <Pencil />
                </Button>
              </div>
              <button type="button" onClick={() => setSelected(a)} className="block w-full p-5 text-left">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl text-[22px]" style={{ background: `color-mix(in oklch, ${color} 18%, transparent)` }}>
                    {a.icon}
                  </span>
                  <div>
                    <div className="text-[15.5px] font-semibold">{a.name}</div>
                    <div className="text-[12.5px] text-muted-foreground">{open.length} açık görev</div>
                  </div>
                </div>
                <div className="mt-5 flex items-baseline justify-between text-[12px] text-muted-foreground">
                  <span>Bu hafta odak / plan</span>
                  <span className="tabular">
                    {formatMinutes(stat?.actualMin ?? 0) || '0dk'} / {formatMinutes(stat?.plannedMin ?? 0) || '0dk'}
                  </span>
                </div>
                <Meter value={stat?.actualMin ?? 0} max={Math.max(stat?.plannedMin ?? 0, 1)} className="mt-1.5 h-1.5" />
                <div className="mt-4 space-y-1">
                  {open.slice(0, 3).map((t) => (
                    <div key={t.id} className="truncate text-[12.5px] text-foreground/80">
                      · {t.title}
                    </div>
                  ))}
                  {open.length === 0 && <div className="text-[12.5px] text-muted-foreground">Boş, sakin.</div>}
                </div>
              </button>
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => setDraft({ id: null, name: '', icon: '📁', color: AREA_COLORS[areas.length % 8] })}
          className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-muted-foreground transition-colors hover:border-ring/50 hover:text-primary"
        >
          <Plus className="size-5" />
          <span className="text-[13px] font-medium">Yeni alan ekle</span>
        </button>
      </div>
      <AreaDialog draft={draft} onClose={() => setDraft(null)} taskCount={draft?.id ? all.filter((t) => t.areaId === draft.id).length : 0} />
    </Page>
  )
}
