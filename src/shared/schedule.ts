import { isoWeekday } from './dates'
import type { FixedEvent, Task } from './types'
import { DEFAULT_ESTIMATE } from './planning'

export const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export const toTime = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** O tarihte geçerli olan sabit etkinlikler (haftanın günü + dönem aralığı), başlangıca göre sıralı */
export function eventsOn(events: FixedEvent[], date: string): FixedEvent[] {
  const wd = isoWeekday(date)
  return events
    .filter((e) => e.weekday === wd && (!e.validFrom || date >= e.validFrom) && (!e.validTo || date <= e.validTo))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

/** Kapasiteden düşülecek meşgul dakika (çakışan etkinlikler iki kez sayılmaz) */
export function busyMinutes(events: FixedEvent[], date: string): number {
  const ranges = eventsOn(events, date)
    .filter((e) => e.countsAgainstCapacity)
    .map((e) => [toMinutes(e.startTime), toMinutes(e.endTime)] as const)
    .filter(([s, e]) => e > s)
  let total = 0
  let curStart = -1
  let curEnd = -1
  for (const [s, e] of ranges) {
    if (s > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart
      curStart = s
      curEnd = e
    } else curEnd = Math.max(curEnd, e)
  }
  if (curEnd > curStart) total += curEnd - curStart
  return total
}

export type NowStatus =
  | { kind: 'event'; title: string; location: string | null; areaId: number | null; start: string; until: string; next: UpcomingItem | null }
  | { kind: 'task'; title: string; taskId: number; areaId: number | null; until: string; next: UpcomingItem | null }
  | { kind: 'free'; next: UpcomingItem | null; freeUntil: string | null }

export interface UpcomingItem {
  kind: 'event' | 'task'
  title: string
  start: string
  location: string | null
  /** Başlamasına kalan dakika */
  inMin: number
}

/**
 * "Şu an neredeyim, sırada ne var?"
 * Önce sabit etkinlik (ders), sonra saati şu ana denk gelen görev bloğu; ikisi de yoksa boş zaman.
 */
export function nowStatus(events: FixedEvent[], tasks: Task[], date: string, minuteOfDay: number): NowStatus {
  const todays = eventsOn(events, date)
  const timed = tasks
    .filter((t) => t.scheduledDate === date && t.scheduledTime && (t.status === 'planned' || t.status === 'active'))
    .map((t) => ({ t, start: toMinutes(t.scheduledTime!), end: toMinutes(t.scheduledTime!) + (t.estimateMin ?? DEFAULT_ESTIMATE) }))

  const upcoming: UpcomingItem[] = [
    ...todays
      .filter((e) => toMinutes(e.startTime) > minuteOfDay)
      .map((e) => ({ kind: 'event' as const, title: e.title, start: e.startTime, location: e.location, inMin: toMinutes(e.startTime) - minuteOfDay })),
    ...timed
      .filter((x) => x.start > minuteOfDay)
      .map((x) => ({ kind: 'task' as const, title: x.t.title, start: x.t.scheduledTime!, location: null, inMin: x.start - minuteOfDay }))
  ].sort((a, b) => a.inMin - b.inMin)
  const next = upcoming[0] ?? null

  const event = todays.find((e) => toMinutes(e.startTime) <= minuteOfDay && minuteOfDay < toMinutes(e.endTime))
  if (event) return { kind: 'event', title: event.title, location: event.location, areaId: event.areaId, start: event.startTime, until: event.endTime, next }

  const block = timed.find((x) => x.start <= minuteOfDay && minuteOfDay < x.end)
  if (block) return { kind: 'task', title: block.t.title, taskId: block.t.id, areaId: block.t.areaId, until: toTime(block.end), next }

  return { kind: 'free', next, freeUntil: next ? next.start : null }
}

/** "1s 20dk sonra" / "5 dk sonra" */
export function inLabel(min: number): string {
  if (min < 60) return `${min} dk sonra`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}s ${m}dk sonra` : `${h} saat sonra`
}
