import { daysInMonth, isoWeekday, parseDate } from './dates'
import type { RecurrenceRule } from './types'

export interface RecurrenceSpec {
  rule: RecurrenceRule
  weekdays: number[]
  dayOfMonth: number | null
  startDate: string
  endDate: string | null
  active: boolean
}

/** Kural bu tarihte bir görev örneği üretmeli mi? */
export function occursOn(spec: RecurrenceSpec, date: string): boolean {
  if (!spec.active) return false
  if (date < spec.startDate) return false
  if (spec.endDate && date > spec.endDate) return false

  const weekday = isoWeekday(date)
  switch (spec.rule) {
    case 'daily':
      return true
    case 'weekdays':
      return weekday <= 5
    case 'weekly':
      return spec.weekdays.includes(weekday)
    case 'monthly': {
      if (!spec.dayOfMonth) return false
      const d = parseDate(date)
      // 31'i seçilen kural, 30 çeken ayda ayın son günü çalışır
      const target = Math.min(spec.dayOfMonth, daysInMonth(d.getFullYear(), d.getMonth() + 1))
      return d.getDate() === target
    }
  }
}

export function parseWeekdays(s: string | null): number[] {
  if (!s) return []
  return s
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
}

export function formatWeekdays(days: number[]): string | null {
  const clean = [...new Set(days)].filter((n) => n >= 1 && n <= 7).sort()
  return clean.length ? clean.join(',') : null
}

/**
 * Alışkanlık zinciri: kuralın ürettiği günlerden kaçı arka arkaya yapılmış.
 * Bugün henüz yapılmadıysa zincir bozulmuş sayılmaz (gün bitmedi); kaçırılan bir gün zinciri sıfırlar.
 */
export function computeStreak(spec: RecurrenceSpec, done: Set<string>, today: string): { current: number; longest: number } {
  const s = { ...spec, active: true }
  const days: string[] = []
  // Başlangıçtan bugüne kuralın ürettiği günler (en fazla ~3 yıl geriye)
  const startLimit = addDaysStr(today, -1100)
  for (let d = s.startDate > startLimit ? s.startDate : startLimit; d <= today; d = addDaysStr(d, 1)) {
    if (occursOn(s, d)) days.push(d)
  }
  let longest = 0
  let run = 0
  for (const d of days) {
    run = done.has(d) ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  // Bugün sırada ama henüz yapılmadıysa bir önceki günden say
  const list = days.length && days[days.length - 1] === today && !done.has(today) ? days.slice(0, -1) : days
  let current = 0
  for (let i = list.length - 1; i >= 0 && done.has(list[i]); i--) current++
  return { current, longest }
}

function addDaysStr(date: string, n: number): string {
  const d = parseDate(date)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
