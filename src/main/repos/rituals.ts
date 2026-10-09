import { db } from '../db'
import { addDays, today } from '../../shared/dates'
import type { DayRitual } from '../../shared/types'

interface RitualRow {
  date: string
  morning_done_at: string | null
  shutdown_done_at: string | null
  note: string | null
}

const toRitual = (date: string, r: RitualRow | undefined): DayRitual => ({
  date,
  morningDoneAt: r?.morning_done_at ?? null,
  shutdownDoneAt: r?.shutdown_done_at ?? null,
  note: r?.note ?? null
})

const get = (date: string): RitualRow | undefined =>
  db.prepare('SELECT * FROM daily_rituals WHERE date = ?').get(date) as RitualRow | undefined

export function getRitual(date: string = today()): DayRitual {
  return toRitual(date, get(date))
}

/** Bir önceki gün kapanışında yazılan "yarın için" notu (en fazla 3 gün geriye bakar) */
export function previousNote(date: string = today()): { date: string; note: string } | null {
  for (let i = 1; i <= 3; i++) {
    const d = addDays(date, -i)
    const r = get(d)
    if (r?.note?.trim()) return { date: d, note: r.note.trim() }
  }
  return null
}

export function completeMorning(date: string = today()): DayRitual {
  db.prepare(
    `INSERT INTO daily_rituals (date, morning_done_at) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET morning_done_at = excluded.morning_done_at`
  ).run(date, new Date().toISOString())
  return getRitual(date)
}

export function completeShutdown(date: string = today(), note: string | null = null): DayRitual {
  const clean = note?.trim().slice(0, 280) || null
  db.prepare(
    `INSERT INTO daily_rituals (date, shutdown_done_at, note) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET shutdown_done_at = excluded.shutdown_done_at, note = excluded.note`
  ).run(date, new Date().toISOString(), clean)
  return getRitual(date)
}

/** Kapanışı geri almak (yanlışlıkla basıldıysa) */
export function reopenDay(date: string = today()): DayRitual {
  db.prepare('UPDATE daily_rituals SET shutdown_done_at = NULL WHERE date = ?').run(date)
  return getRitual(date)
}
