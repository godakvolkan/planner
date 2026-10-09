import { db } from '../db'
import { addDays, today } from '../../shared/dates'
import { computeStreak, formatWeekdays, occursOn, parseWeekdays } from '../../shared/recurrence'
import type { Priority, Recurrence, RecurrenceInput } from '../../shared/types'

interface RecurrenceRow {
  id: number
  title: string
  area_id: number | null
  estimate_min: number | null
  priority: number
  first_step: string | null
  rule: Recurrence['rule']
  weekdays: string | null
  day_of_month: number | null
  time: string | null
  start_date: string
  end_date: string | null
  active: number
  is_habit?: number
  current_streak?: number
  longest_streak?: number
}

/** Zincir kayıtlardan hesaplanır (gün kaçırılınca kendiliğinden sıfırlanır) */
function streakOf(r: RecurrenceRow): { current: number; longest: number } {
  if (r.is_habit !== 1) return { current: 0, longest: 0 }
  const done = new Set((db.prepare('SELECT date FROM habit_logs WHERE recurrence_id = ?').all(r.id) as { date: string }[]).map((x) => x.date))
  const spec = { rule: r.rule, weekdays: parseWeekdays(r.weekdays), dayOfMonth: r.day_of_month, startDate: r.start_date, endDate: r.end_date, active: true }
  return computeStreak(spec, done, today())
}

function toRecurrence(r: RecurrenceRow): Recurrence {
  const streak = streakOf(r)
  return {
    id: r.id,
    title: r.title,
    areaId: r.area_id,
    estimateMin: r.estimate_min,
    priority: r.priority as Priority,
    firstStep: r.first_step,
    rule: r.rule,
    weekdays: parseWeekdays(r.weekdays),
    dayOfMonth: r.day_of_month,
    time: r.time,
    startDate: r.start_date,
    endDate: r.end_date,
    active: r.active === 1,
    isHabit: r.is_habit === 1,
    currentStreak: streak.current,
    longestStreak: streak.longest
  }
}

function validate(input: Partial<RecurrenceInput>): void {
  if (input.title !== undefined && !input.title.trim()) throw new Error('Başlık boş olamaz')
  if (input.rule === 'weekly' && input.weekdays !== undefined && !formatWeekdays(input.weekdays)) {
    throw new Error('Haftalık tekrar için en az bir gün seçilmeli')
  }
  if (input.rule === 'monthly' && input.dayOfMonth !== undefined) {
    if (!input.dayOfMonth || input.dayOfMonth < 1 || input.dayOfMonth > 31) throw new Error('Ayın günü 1–31 arası olmalı')
  }
}

function mustGet(id: number): Recurrence {
  const row = db.prepare('SELECT * FROM recurrences WHERE id = ?').get(id) as RecurrenceRow | undefined
  if (!row) throw new Error(`Tekrar kuralı bulunamadı (#${id})`)
  return toRecurrence(row)
}

export function listRecurrences(): Recurrence[] {
  return (db.prepare('SELECT * FROM recurrences ORDER BY active DESC, title COLLATE NOCASE').all() as RecurrenceRow[]).map(
    toRecurrence
  )
}

export function createRecurrence(input: RecurrenceInput): Recurrence {
  validate(input)
  if (input.rule === 'weekly' && !formatWeekdays(input.weekdays ?? [])) {
    throw new Error('Haftalık tekrar için en az bir gün seçilmeli')
  }
  if (input.rule === 'monthly' && !input.dayOfMonth) throw new Error('Aylık tekrar için ayın günü seçilmeli')
  const info = db
    .prepare(
      `INSERT INTO recurrences (title, area_id, estimate_min, priority, first_step, rule, weekdays, day_of_month, time, start_date, end_date, is_habit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.title.trim(),
      input.areaId ?? null,
      input.estimateMin ?? null,
      input.priority ?? 1,
      input.firstStep ?? null,
      input.rule,
      formatWeekdays(input.weekdays ?? []),
      input.dayOfMonth ?? null,
      input.time ?? null,
      input.startDate ?? today(),
      input.endDate ?? null,
      input.isHabit ? 1 : 0
    )
  const created = mustGet(Number(info.lastInsertRowid))
  generateInstances()
  return created
}

export function updateRecurrence(id: number, patch: Partial<RecurrenceInput>): Recurrence {
  const current = mustGet(id)
  validate({ ...patch, rule: patch.rule ?? current.rule })
  const map: Record<string, [string, unknown]> = {
    title: ['title', patch.title?.trim()],
    areaId: ['area_id', patch.areaId],
    estimateMin: ['estimate_min', patch.estimateMin],
    priority: ['priority', patch.priority],
    firstStep: ['first_step', patch.firstStep],
    rule: ['rule', patch.rule],
    weekdays: ['weekdays', patch.weekdays && formatWeekdays(patch.weekdays)],
    dayOfMonth: ['day_of_month', patch.dayOfMonth],
    time: ['time', patch.time],
    startDate: ['start_date', patch.startDate],
    endDate: ['end_date', patch.endDate],
    isHabit: ['is_habit', patch.isHabit !== undefined ? (patch.isHabit ? 1 : 0) : undefined]
  }
  const entries = Object.entries(map).filter(([key]) => patch[key as keyof RecurrenceInput] !== undefined)
  if (entries.length) {
    db.prepare(`UPDATE recurrences SET ${entries.map(([, [col]]) => `${col} = ?`).join(', ')} WHERE id = ?`).run(
      ...entries.map(([, [, v]]) => v),
      id
    )
  }
  return mustGet(id)
}

export function resumeRecurrence(id: number): Recurrence {
  mustGet(id)
  db.prepare('UPDATE recurrences SET active = 1 WHERE id = ?').run(id)
  generateInstances()
  return mustGet(id)
}

export function deleteRecurrence(id: number): void {
  mustGet(id)
  // Üretilmiş görevler kalır, sadece kurala bağları kopar
  db.prepare('UPDATE tasks SET recurrence_id = NULL WHERE recurrence_id = ?').run(id)
  db.prepare('DELETE FROM recurrences WHERE id = ?').run(id)
}

export function stopRecurrence(id: number): Recurrence {
  mustGet(id)
  db.prepare('UPDATE recurrences SET active = 0 WHERE id = ?').run(id)
  return mustGet(id)
}

/**
 * Aktif kurallardan bugün ve yarın için görev örneği üretir (EK_OZELLIKLER §1.1).
 * recurrence_log sayesinde aynı gün için ikinci kez üretmez; kullanıcı örneği silse bile geri gelmez.
 * Üretilen görev sayısını döner.
 */
const generateInstancesTx = db.transaction((from: string = today(), days = 2): number => {
  const rules = listRecurrences().filter((r) => r.active)
  const logged = db.prepare('INSERT OR IGNORE INTO recurrence_log (recurrence_id, date) VALUES (?, ?)')
  const insert = db.prepare(
    `INSERT INTO tasks (title, area_id, status, priority, scheduled_date, scheduled_time, estimate_min, first_step, recurrence_id, created_at)
     VALUES (?, ?, 'planned', ?, ?, ?, ?, ?, ?, ?)`
  )
  let created = 0
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i)
    for (const r of rules) {
      if (!occursOn(r, date)) continue
      if (logged.run(r.id, date).changes === 0) continue
      insert.run(r.title, r.areaId, r.priority, date, r.time, r.estimateMin, r.firstStep, r.id, new Date().toISOString())
      created++
    }
  }
  return created
})

export function generateInstances(from: string = today(), days = 2): number {
  return generateInstancesTx(from, days)
}
