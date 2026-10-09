import { db } from '../db'
import { addDays, isoWeekday, parseDate, today, weekStart } from '../../shared/dates'
import type { AreaWeekStat, DaySummary, Energy, WeekStats } from '../../shared/types'

export function setEnergy(date: string, energy: Energy | null): void {
  if (energy !== null && !['low', 'medium', 'high'].includes(energy)) throw new Error('Geçersiz enerji')
  db.prepare(
    'INSERT INTO daily_stats (date, energy) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET energy = excluded.energy'
  ).run(date, energy)
}

function energyOf(date: string): Energy | null {
  const row = db.prepare('SELECT energy FROM daily_stats WHERE date = ?').get(date) as { energy: Energy | null } | undefined
  return row?.energy ?? null
}
import { capacityFor } from './settings'
import { listEvents } from './events'
import { busyMinutes } from '../../shared/schedule'
import { buildProfile, type EstimationProfile, type EstimationSample } from '../../shared/estimation'

/** Oturumlar UTC ISO olarak saklanır; yerel günün başlangıcı UTC'ye çevrilir */
const dayStartIso = (date: string): string => parseDate(date).toISOString()

function focusMinutes(from: string, toExclusive: string): number {
  const row = db
    .prepare(
      'SELECT COALESCE(SUM(duration_min), 0) AS m FROM sessions WHERE ended_at IS NOT NULL AND started_at >= ? AND started_at < ?'
    )
    .get(dayStartIso(from), dayStartIso(toExclusive)) as { m: number }
  return row.m
}

export function daySummary(date: string = today()): DaySummary {
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(estimate_min), 0) AS planned,
         COALESCE(SUM(CASE WHEN status != 'done' THEN estimate_min END), 0) AS remaining,
         COALESCE(SUM(status = 'done'), 0) AS done,
         COALESCE(SUM(status != 'done'), 0) AS open
       FROM tasks
       WHERE parent_id IS NULL AND status IN ('planned', 'active', 'done')
         AND (scheduled_date = ? OR (status != 'done' AND scheduled_date < ?))`
    )
    .get(date, date) as { planned: number; remaining: number; done: number; open: number }
  const busyMin = busyMinutes(listEvents(), date)
  return {
    date,
    capacityMin: Math.max(0, capacityFor(date, isoWeekday(date)) - busyMin),
    busyMin,
    plannedMin: row.planned,
    remainingMin: row.remaining,
    actualMin: focusMinutes(date, addDays(date, 1)),
    energy: energyOf(date),
    doneCount: row.done,
    openCount: row.open
  }
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function weekStats(date: string = today()): WeekStats {
  const start = weekStart(date)
  const end = addDays(start, 6)
  const startIso = dayStartIso(start)
  const endIso = dayStartIso(addDays(end, 1))

  const byArea = db
    .prepare(
      `SELECT t.area_id AS areaId,
         COALESCE(SUM(t.estimate_min), 0) AS plannedMin,
         COALESCE(SUM((SELECT SUM(duration_min) FROM sessions s WHERE s.task_id = t.id AND s.ended_at IS NOT NULL)), 0) AS actualMin,
         COALESCE(SUM(t.status = 'done'), 0) AS doneCount
       FROM tasks t
       WHERE t.parent_id IS NULL AND t.status != 'archived'
         AND (t.scheduled_date BETWEEN ? AND ? OR t.planned_week = ?)
       GROUP BY t.area_id
       ORDER BY plannedMin DESC`
    )
    .all(start, end, start) as AreaWeekStat[]

  const done = db
    .prepare(`SELECT COUNT(*) AS n FROM tasks WHERE status = 'done' AND parent_id IS NULL AND completed_at >= ? AND completed_at < ?`)
    .get(startIso, endIso) as { n: number }
  const postponed = db
    .prepare('SELECT COUNT(*) AS n FROM postpone_log WHERE date BETWEEN ? AND ?')
    .get(start, end) as { n: number }

  const ratios = (
    db
      .prepare(
        `SELECT t.estimate_min AS est, SUM(s.duration_min) AS act FROM tasks t JOIN sessions s ON s.task_id = t.id
         WHERE t.status = 'done' AND t.estimate_min > 0 AND s.ended_at IS NOT NULL
         GROUP BY t.id HAVING act > 0`
      )
      .all() as { est: number; act: number }[]
  ).map((r) => r.act / r.est)

  const focusByDay = Array.from({ length: 7 }, (_, i) => focusMinutes(addDays(start, i), addDays(start, i + 1)))
  return {
    weekStart: start,
    plannedMin: byArea.reduce((a, r) => a + r.plannedMin, 0),
    actualMin: focusByDay.reduce((a, m) => a + m, 0),
    doneCount: done.n,
    postponedCount: postponed.n,
    focusByDay,
    byArea,
    estimateRatio: ratios.length >= 3 ? median(ratios) : null,
    postponeReasons: db
      .prepare(
        `SELECT reason, COUNT(*) AS count FROM postpone_log WHERE reason IS NOT NULL AND date >= ? GROUP BY reason ORDER BY count DESC`
      )
      .all(addDays(date, -30)) as { reason: string; count: number }[]
  }
}

/** Son 180 günde tamamlanan, tahmini ve ölçülen süresi olan üst görevlerden kişisel tahmin profili */
export function estimationProfile(): EstimationProfile {
  const since = new Date(Date.now() - 180 * 86_400_000).toISOString()
  const rows = db
    .prepare(
      `SELECT t.area_id AS areaId, t.estimate_min AS estimateMin, SUM(s.duration_min) AS actualMin
       FROM tasks t JOIN sessions s ON s.task_id = t.id
       WHERE t.status = 'done' AND t.parent_id IS NULL AND t.estimate_min > 0 AND s.ended_at IS NOT NULL AND t.completed_at >= ?
       GROUP BY t.id`
    )
    .all(since) as EstimationSample[]
  return buildProfile(rows)
}
