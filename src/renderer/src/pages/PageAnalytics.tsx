import * as React from 'react'
import { CheckCircle2, Clock, Hourglass, Repeat2, Scale } from 'lucide-react'
import { addDays, today } from '../../../shared/dates'
import { Page, Section, StatCard } from '@/components/common/Page'
import { useApp } from '@/lib/app-context'
import { useData } from '@/lib/data'
import { formatMinutes, formatShortDate, weekdayShort } from '@/lib/format'
import { areaColor, findArea } from '@/lib/areas'
import { cn } from '@/lib/utils'
import { POSTPONE_REASONS } from '../../../shared/v2'

export function PageAnalytics(): React.JSX.Element {
  const { areas, estimation } = useApp()
  const week = useData(() => window.api.stats.week()).data
  const todayStr = today()

  const maxFocus = Math.max(60, ...(week?.focusByDay ?? [0]))
  const ratio = week?.estimateRatio
  const insight =
    ratio == null
      ? 'Birkaç görevi Focus ile tamamlayınca tahmin alışkanlığını göstereceğim.'
      : ratio > 1.15
        ? `İşlerin genelde tahminden %${Math.round((ratio - 1) * 100)} uzun sürüyor. Yeni görevlerde biraz pay bırak.`
        : ratio < 0.85
          ? `İşlerin tahminden %${Math.round((1 - ratio) * 100)} kısa sürüyor. Tahminlerin temkinli.`
          : 'Tahminlerin gerçeğe çok yakın. Böyle devam.'

  return (
    <Page title="Analiz" subtitle={week ? `Bu hafta · ${formatShortDate(week.weekStart)} – ${formatShortDate(addDays(week.weekStart, 6))}` : 'Bu hafta'}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Hourglass} label="Planlanan" value={formatMinutes(week?.plannedMin ?? 0) || '0dk'} hint="tahmini toplam" />
        <StatCard icon={Clock} label="Odak" value={formatMinutes(week?.actualMin ?? 0) || '0dk'} hint="ölçülen süre" />
        <StatCard icon={CheckCircle2} label="Tamamlanan" value={week?.doneCount ?? 0} hint="görev" />
        <StatCard icon={Repeat2} label="Erteleme" value={week?.postponedCount ?? 0} hint="kez" />
      </div>

      <div className="surface-hero mt-5 flex items-center gap-4 p-5">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white glow">
          <Scale className="size-5" />
        </div>
        <div>
          <div className="section-label !text-primary">Tahmin alışkanlığın</div>
          <div className="mt-0.5 text-[14.5px] font-medium">{insight}</div>
        </div>
        {ratio != null && <div className="ml-auto text-[28px] font-semibold tabular text-brand">{ratio.toFixed(2)}×</div>}
      </div>
      {(estimation?.byArea.length ?? 0) > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          {estimation!.byArea.map((a) => {
            const area = findArea(areas, a.areaId)
            const off = a.ratio > 1.2 ? 'text-warning' : a.ratio < 0.8 ? 'text-primary' : 'text-success'
            return (
              <div key={a.areaId ?? 'none'} className="surface flex items-center gap-3 px-4 py-3">
                <span className="size-2 shrink-0 rounded-full" style={{ background: areaColor(area) }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{area?.name ?? 'Alansız'}</div>
                  <div className="text-[11.5px] text-muted-foreground">{a.n} tamamlanmış işe göre</div>
                </div>
                <span className={cn('text-[17px] font-semibold tabular', off)}>{a.ratio.toFixed(2)}×</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-2 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="Günlük odak">
          <div className="surface flex h-[220px] items-end gap-3 p-5">
            {(week?.focusByDay ?? Array(7).fill(0)).map((m, i) => {
              const date = week ? addDays(week.weekStart, i) : todayStr
              const isToday = date === todayStr
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[11px] tabular text-muted-foreground">{m ? formatMinutes(m) : ''}</span>
                  <div className="flex h-[130px] w-full items-end overflow-hidden rounded-lg bg-muted/60">
                    <div className="w-full rounded-lg bg-brand transition-[height] duration-700" style={{ height: `${(m / maxFocus) * 100}%`, minHeight: m ? 4 : 0 }} />
                  </div>
                  <span className={isToday ? 'text-[11.5px] font-semibold text-primary' : 'text-[11.5px] text-muted-foreground'}>{weekdayShort(date)}</span>
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="Alanlara göre: plan / gerçek">
          <div className="surface space-y-4 p-5">
            {(week?.byArea ?? []).length === 0 && <div className="text-[13px] text-muted-foreground">Bu hafta planlanmış görev yok.</div>}
            {(week?.byArea ?? []).map((s) => {
              const area = findArea(areas, s.areaId)
              const max = Math.max(s.plannedMin, s.actualMin, 1)
              const color = areaColor(area)
              return (
                <div key={s.areaId ?? 'none'}>
                  <div className="flex items-baseline justify-between text-[12.5px]">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="size-2 rounded-full" style={{ background: color }} /> {area?.name ?? 'Alansız'}
                    </span>
                    <span className="tabular text-muted-foreground">
                      {formatMinutes(s.actualMin) || '0dk'} / {formatMinutes(s.plannedMin) || '0dk'}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full opacity-40" style={{ width: `${(s.plannedMin / max) * 100}%`, background: color }} />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${(s.actualMin / max) * 100}%`, background: color }} />
                    </div>
                  </div>
                </div>
              )
            })}
            {(week?.byArea ?? []).length > 0 && (
              <div className="flex gap-4 pt-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-foreground/25" /> Plan</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-foreground/70" /> Gerçek</span>
              </div>
            )}
          </div>
        </Section>
      </div>

      <Section title="Neden erteliyorum? (son 30 gün)">
        <div className="surface p-5">
          {(week?.postponeReasons ?? []).length === 0 ? (
            <div className="text-[13px] text-muted-foreground">Henüz veri yok. Bir görev 3. kez ertelendiğinde nedenini soracağım.</div>
          ) : (
            <div className="space-y-2.5">
              {week!.postponeReasons.map((r) => {
                const meta = POSTPONE_REASONS.find((x) => x.id === r.reason)
                const max = week!.postponeReasons[0].count
                return (
                  <div key={r.reason}>
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="font-medium">{meta?.label ?? r.reason}</span>
                      <span className="tabular text-muted-foreground">{r.count} kez</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${(r.count / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
              <div className="pt-2 text-[12.5px] text-muted-foreground">
                <span className="font-medium text-foreground">Öneri: </span>
                {POSTPONE_REASONS.find((x) => x.id === week!.postponeReasons[0].reason)?.advice}
              </div>
            </div>
          )}
        </div>
      </Section>
    </Page>
  )
}
