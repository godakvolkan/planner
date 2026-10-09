import { db } from '../db'
import type { FixedEvent, FixedEventInput } from '../../shared/types'

interface EventRow {
  id: number
  title: string
  area_id: number | null
  weekday: number
  start_time: string
  end_time: string
  location: string | null
  valid_from: string | null
  valid_to: string | null
  counts_against_capacity: number
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

const toEvent = (r: EventRow): FixedEvent => ({
  id: r.id,
  title: r.title,
  areaId: r.area_id,
  weekday: r.weekday,
  startTime: r.start_time,
  endTime: r.end_time,
  location: r.location,
  validFrom: r.valid_from,
  validTo: r.valid_to,
  countsAgainstCapacity: r.counts_against_capacity === 1
})

function validate(e: Partial<FixedEventInput>): void {
  if (e.title !== undefined && !e.title.trim()) throw new Error('Ders adı boş olamaz')
  if (e.weekday !== undefined && (!Number.isInteger(e.weekday) || e.weekday < 1 || e.weekday > 7)) throw new Error('Geçersiz gün')
  for (const t of [e.startTime, e.endTime]) if (t !== undefined && !TIME.test(t)) throw new Error('Saat SS:dd formatında olmalı')
  if (e.startTime && e.endTime && e.startTime >= e.endTime) throw new Error('Bitiş saati başlangıçtan sonra olmalı')
  if (e.validFrom && e.validTo && e.validFrom > e.validTo) throw new Error('Dönem sonu başından önce olamaz')
}

function mustGet(id: number): FixedEvent {
  const row = db.prepare('SELECT * FROM fixed_events WHERE id = ?').get(id) as EventRow | undefined
  if (!row) throw new Error(`Ders bulunamadı (#${id})`)
  return toEvent(row)
}

export function listEvents(): FixedEvent[] {
  return (db.prepare('SELECT * FROM fixed_events ORDER BY weekday, start_time').all() as EventRow[]).map(toEvent)
}

const createTx = db.transaction((input: Omit<FixedEventInput, 'weekday'> & { weekdays: number[] }): FixedEvent[] => {
  const days = [...new Set(input.weekdays)]
  if (!days.length) throw new Error('En az bir gün seç')
  const insert = db.prepare(
    `INSERT INTO fixed_events (title, area_id, weekday, start_time, end_time, location, valid_from, valid_to, counts_against_capacity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  return days.map((weekday) => {
    validate({ ...input, weekday })
    const info = insert.run(
      input.title.trim(),
      input.areaId ?? null,
      weekday,
      input.startTime,
      input.endTime,
      input.location?.trim() || null,
      input.validFrom ?? null,
      input.validTo ?? null,
      input.countsAgainstCapacity === false ? 0 : 1
    )
    return mustGet(Number(info.lastInsertRowid))
  })
})

export function createEvents(input: Omit<FixedEventInput, 'weekday'> & { weekdays: number[] }): FixedEvent[] {
  return createTx(input)
}

export function updateEvent(id: number, patch: Partial<FixedEventInput>): FixedEvent {
  const current = mustGet(id)
  validate({ ...current, ...patch })
  const map: Record<string, [string, unknown]> = {
    title: ['title', patch.title?.trim()],
    areaId: ['area_id', patch.areaId],
    weekday: ['weekday', patch.weekday],
    startTime: ['start_time', patch.startTime],
    endTime: ['end_time', patch.endTime],
    location: ['location', patch.location === undefined ? undefined : patch.location?.trim() || null],
    validFrom: ['valid_from', patch.validFrom],
    validTo: ['valid_to', patch.validTo],
    countsAgainstCapacity: ['counts_against_capacity', patch.countsAgainstCapacity === undefined ? undefined : patch.countsAgainstCapacity ? 1 : 0]
  }
  const entries = Object.entries(map).filter(([key]) => patch[key as keyof FixedEventInput] !== undefined)
  if (entries.length) {
    db.prepare(`UPDATE fixed_events SET ${entries.map(([, [c]]) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
      ...entries.map(([, [, v]]) => v),
      id
    )
  }
  return mustGet(id)
}

export function deleteEvent(id: number): void {
  mustGet(id)
  db.prepare('DELETE FROM fixed_events WHERE id = ?').run(id)
}
