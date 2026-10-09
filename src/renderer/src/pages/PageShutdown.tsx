import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarClock, Check, CheckCircle2, Clock, Inbox, Moon, Timer, X } from 'lucide-react'
import { toast } from 'sonner'
import type { MoveTarget } from '../../../shared/types'
import { today } from '../../../shared/dates'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/app-context'
import { refreshAll, useData } from '@/lib/data'
import { formatDayTitle, formatMinutes } from '@/lib/format'
import { areaColor, findArea } from '@/lib/areas'
import { cn } from '@/lib/utils'

/** Gün kapanışı: ne yaptım, ne kaldı, yarına tek satır not. Suçlayıcı dil yok. */
export function PageShutdown(): React.JSX.Element {
  const navigate = useNavigate()
  const { areas, session } = useApp()
  const todayStr = today()
  const todays = useData(() => window.api.tasks.list({ view: 'today' })).data ?? []
  const doneToday = useData(() => window.api.tasks.list({ view: 'range', from: todayStr, to: todayStr })).data ?? []
  const summary = useData(() => window.api.stats.day()).data
  const ritual = useData(() => window.api.rituals.get(todayStr)).data
  const [note, setNote] = React.useState('')
  const [moved, setMoved] = React.useState<Record<number, string>>({})
  React.useEffect(() => {
    if (ritual?.note) setNote(ritual.note)
  }, [ritual?.note])

  const done = doneToday.filter((t) => t.status === 'done' && t.parentId === null)
  const remaining = todays.filter((t) => (t.status === 'planned' || t.status === 'active') && !moved[t.id])
  const estimated = done.filter((t) => t.estimateMin && t.actualMin).reduce((a, t) => a + (t.estimateMin ?? 0), 0)
  const actual = done.filter((t) => t.estimateMin && t.actualMin).reduce((a, t) => a + t.actualMin, 0)
  const diff = actual - estimated

  const move = async (id: number, target: MoveTarget, label: string): Promise<void> => {
    try {
      await window.api.tasks.move(id, target)
      setMoved((m) => ({ ...m, [id]: label }))
      refreshAll()
    } catch {
      toast.error('Taşınamadı.')
    }
  }

  const close = async (): Promise<void> => {
    try {
      await window.api.rituals.completeShutdown(todayStr, note.trim() || null)
      refreshAll()
      toast.success('Gün kapandı. İyi dinlenmeler 🌙', {
        description: note.trim() ? 'Notun yarın sabah seni bekliyor.' : undefined,
        action: { label: 'Geri al', onClick: () => window.api.rituals.reopen(todayStr).then(refreshAll, () => undefined) }
      })
      navigate('/')
    } catch {
      toast.error('Kaydedilemedi.')
    }
  }

  return (
    <div className="relative flex h-full flex-col overflow-y-auto">
      <div className="drag absolute inset-x-0 top-0 h-10" />
      <div className="mx-auto w-full max-w-[760px] px-8 pb-12 pt-12 max-md:px-5 max-sm:px-4 max-sm:pt-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand text-white glow">
            <Moon className="size-5" />
          </span>
          <div>
            <div className="text-[12.5px] font-medium text-muted-foreground">{formatDayTitle(todayStr)}</div>
            <h1 className="text-[26px] font-semibold tracking-tight">Günü kapatalım</h1>
          </div>
          <Button variant="ghost" className="ml-auto gap-1.5 text-muted-foreground" onClick={() => navigate('/')}>
            <X className="size-4" /> Şimdi değil
          </Button>
        </div>

        {ritual?.shutdownDoneAt && (
          <div className="mt-5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-[13px]">
            Bugün zaten kapatıldı. Değişiklik yaparsan tekrar kaydedilir.
          </div>
        )}

        {/* Bugün */}
        <div className="mt-6 grid grid-cols-3 gap-3 max-sm:grid-cols-2">
          <div className="surface p-4">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
              <CheckCircle2 className="size-3.5" /> Tamamlanan
            </div>
            <div className="mt-1 text-[24px] font-semibold tabular">{done.length}</div>
          </div>
          <div className="surface p-4">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
              <Clock className="size-3.5" /> Odak
            </div>
            <div className="mt-1 text-[24px] font-semibold tabular">{formatMinutes(summary?.actualMin ?? 0) || '0dk'}</div>
          </div>
          <div className="surface p-4 max-sm:col-span-2">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
              <Timer className="size-3.5" /> Tahmin → gerçek
            </div>
            <div className="mt-1 text-[16px] font-semibold tabular">
              {estimated ? (
                <>
                  {formatMinutes(estimated)} → {formatMinutes(actual)}{' '}
                  <span className={cn('text-[13px]', diff > 0 ? 'text-warning' : 'text-success')}>
                    ({diff >= 0 ? '+' : '−'}
                    {formatMinutes(Math.abs(diff)) || '0dk'})
                  </span>
                </>
              ) : (
                <span className="text-[13px] font-normal text-muted-foreground">Focus ile ölçülen iş yok</span>
              )}
            </div>
          </div>
        </div>

        {done.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {done.slice(0, 12).map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-2.5 py-1 text-[12px]">
                <Check className="size-3 text-success" strokeWidth={3} /> {t.title}
              </span>
            ))}
          </div>
        )}

        {/* Kalanlar */}
        <div className="surface mt-6 p-6 max-sm:p-4">
          <h2 className="text-[16px] font-semibold">{remaining.length ? `Bugün ${remaining.length} görev kaldı` : 'Bugünlük hepsi yerinde'}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {remaining.length ? 'Her birine yarın sabah bakmamak için şimdi bir yer seç.' : 'Kalan iş yok. Yarına temiz başlıyorsun.'}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {remaining.map((t) => {
              const area = findArea(areas, t.areaId)
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card/60 px-4 py-3 max-sm:px-3">
                  <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: areaColor(area) }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{t.title}</div>
                    <div className="text-[12px] text-muted-foreground">
                      {[formatMinutes(t.estimateMin), area?.name, session?.taskId === t.id && 'odakta (gün kapanınca durur)', t.postponeCount > 1 && `${t.postponeCount} kez ertelendi, belki parçalamak iyi olur`]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  {/* Dar pencerede düğmeler başlığın altına iner */}
                  <div className="flex shrink-0 flex-wrap gap-1 max-sm:w-full max-sm:pl-[15px]">
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => move(t.id, { to: 'tomorrow' }, 'Yarın')}>
                      <ArrowRight className="size-3.5" /> Yarın
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => move(t.id, { to: 'thisWeek' }, 'Bu hafta')}>
                      <CalendarClock className="size-3.5" /> Bu hafta
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => move(t.id, { to: 'inbox' }, 'Inbox')}>
                      <Inbox className="size-3.5" /> Inbox
                    </Button>
                  </div>
                </div>
              )
            })}
            {remaining.length > 1 && (
              <Button
                variant="ghost"
                className="self-start"
                onClick={async () => {
                  for (const t of remaining) await move(t.id, { to: 'tomorrow' }, 'Yarın')
                }}
              >
                Hepsini yarına taşı
              </Button>
            )}
          </div>
        </div>

        {/* Yarın için not */}
        <div className="surface mt-4 p-6">
          <h2 className="text-[16px] font-semibold">Yarın için tek satır</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Sabah ilk bunu göreceksin. Kafanda kalan bir şeyi buraya bırak.</p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && close()}
            maxLength={280}
            placeholder="örn. Rapora sonuç bölümünden başla"
            className="mt-3 h-11 w-full rounded-xl border bg-background/50 px-4 text-[14px] outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <div className="mt-5 flex justify-end">
          <Button className="gap-2 border-0 bg-brand px-6 font-semibold text-white glow" onClick={close}>
            <Moon className="size-4" /> Günü kapat
          </Button>
        </div>
      </div>
    </div>
  )
}
