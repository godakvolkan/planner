import { db } from '../db'
import type { DayCapacity, Settings } from '../../shared/types'
import { DEFAULT_POMODORO, type PomodoroConfig } from '../../shared/pomodoro'
import { ACTIONS, findConflict, formatCombo, actionLabel, normalizeCombo, resolveBindings, validateCombo, type ActionId } from '../../shared/keybindings'

/** Kısayol değişikliklerini doğrular; varsayılana eşit olanları saklamaz */
function cleanKeybindings(input: Partial<Record<string, string>>): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {}
  for (const a of ACTIONS) {
    const v = input[a.id]
    if (typeof v !== 'string' || !v.trim()) continue
    const c = normalizeCombo(v)
    const err = validateCombo(a.id, c)
    if (err) throw new Error(`${a.label}: ${err}`)
    if (c !== a.default) out[a.id] = c
  }
  const resolved = resolveBindings(out)
  for (const a of ACTIONS) {
    const other = findConflict(resolved, a.id as ActionId, resolved[a.id])
    if (other) throw new Error(`${formatCombo(resolved[a.id])} hem "${a.label}" hem "${actionLabel(other)}" için kullanılıyor`)
  }
  return out
}

const DEFAULTS: Settings = {
  userName: '',
  theme: 'light',
  dayStart: '08:00',
  dayEnd: '22:00',
  notifyEnabled: true,
  notifyLeadMin: 10,
  notifyMorning: true,
  notifySound: 'default',
  closeToTray: true,
  launchAtLogin: false,
  ritualsEnabled: true,
  pomodoro: DEFAULT_POMODORO,
  pomodoroSound: true,
  keybindings: {}
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function getSettings(): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const stored: Partial<Settings> = {}
  for (const r of rows) {
    if (!(r.key in DEFAULTS)) continue
    try {
      ;(stored as Record<string, unknown>)[r.key] = JSON.parse(r.value)
    } catch {
      // bozuk değer varsayılana düşer
    }
  }
  return { ...DEFAULTS, ...stored }
}

export function updateSettings(patch: Partial<Settings>): Settings {
  if (patch.theme && !['dark', 'light', 'system'].includes(patch.theme)) throw new Error('Geçersiz tema')
  if (patch.notifySound && !['default', 'chime', 'soft', 'none'].includes(patch.notifySound)) throw new Error('Geçersiz bildirim sesi')
  for (const key of ['dayStart', 'dayEnd'] as const) {
    const v = patch[key]
    if (v !== undefined && !TIME.test(v)) throw new Error('Saat SS:dd formatında olmalı')
  }
  if (patch.notifyLeadMin !== undefined && (!Number.isInteger(patch.notifyLeadMin) || patch.notifyLeadMin < 0 || patch.notifyLeadMin > 120)) {
    throw new Error('Hatırlatma 0–120 dakika arası olmalı')
  }
  if (patch.keybindings !== undefined) patch = { ...patch, keybindings: cleanKeybindings(patch.keybindings) }
  if (patch.pomodoro !== undefined) patch = { ...patch, pomodoro: cleanPomodoro(patch.pomodoro) }
  const next = { ...getSettings(), ...patch }
  if (next.dayStart >= next.dayEnd) throw new Error('Gün bitişi başlangıçtan sonra olmalı')
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  db.transaction(() => {
    for (const [key, value] of Object.entries(patch)) {
      if (key in DEFAULTS && value !== undefined) upsert.run(key, JSON.stringify(value))
    }
  })()
  return getSettings()
}

export function listCapacity(): DayCapacity[] {
  return db.prepare('SELECT weekday, minutes FROM day_capacity ORDER BY weekday').all() as DayCapacity[]
}

export function setCapacity(weekday: number, minutes: number): DayCapacity[] {
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) throw new Error('Geçersiz gün')
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 24 * 60) throw new Error('Kapasite 0–24 saat arası olmalı')
  db.prepare(
    'INSERT INTO day_capacity (weekday, minutes) VALUES (?, ?) ON CONFLICT(weekday) DO UPDATE SET minutes = excluded.minutes'
  ).run(weekday, minutes)
  return listCapacity()
}

/** capacity_overrides varsa o, yoksa haftanın günü kapasitesi */
export function capacityFor(date: string, weekday: number): number {
  const override = db.prepare('SELECT minutes FROM capacity_overrides WHERE date = ?').get(date) as
    | { minutes: number }
    | undefined
  if (override) return override.minutes
  const row = db.prepare('SELECT minutes FROM day_capacity WHERE weekday = ?').get(weekday) as
    | { minutes: number }
    | undefined
  return row?.minutes ?? 300
}

export function setCapacityOverride(date: string, minutes: number | null): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Geçersiz tarih')
  if (minutes === null) {
    db.prepare('DELETE FROM capacity_overrides WHERE date = ?').run(date)
    return
  }
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 24 * 60) throw new Error('Kapasite 0–24 saat arası olmalı')
  db.prepare(
    'INSERT INTO capacity_overrides (date, minutes) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET minutes = excluded.minutes'
  ).run(date, minutes)
}

export function getCapacityOverride(date: string): number | null {
  const row = db.prepare('SELECT minutes FROM capacity_overrides WHERE date = ?').get(date) as { minutes: number } | undefined
  return row?.minutes ?? null
}

function cleanPomodoro(p: Partial<PomodoroConfig>): PomodoroConfig {
  const n = (v: unknown, min: number, max: number, def: number): number =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : def
  return {
    workMin: n(p.workMin, 5, 120, DEFAULT_POMODORO.workMin),
    shortMin: n(p.shortMin, 1, 30, DEFAULT_POMODORO.shortMin),
    longMin: n(p.longMin, 5, 60, DEFAULT_POMODORO.longMin),
    cyclesBeforeLong: n(p.cyclesBeforeLong, 2, 8, DEFAULT_POMODORO.cyclesBeforeLong),
    autoStartWork: typeof p.autoStartWork === 'boolean' ? p.autoStartWork : DEFAULT_POMODORO.autoStartWork,
    autoStartBreak: typeof p.autoStartBreak === 'boolean' ? p.autoStartBreak : DEFAULT_POMODORO.autoStartBreak
  }
}
