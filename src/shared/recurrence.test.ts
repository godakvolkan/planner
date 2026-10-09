import { describe, expect, it } from 'vitest'
import { occursOn, formatWeekdays, parseWeekdays, type RecurrenceSpec } from './recurrence'
import { addDays, isoWeekday, toDateString, weekStart } from './dates'

const spec = (over: Partial<RecurrenceSpec>): RecurrenceSpec => ({
  rule: 'daily',
  weekdays: [],
  dayOfMonth: null,
  startDate: '2026-01-01',
  endDate: null,
  active: true,
  ...over
})

// 2026-10-05 Pazartesi, 2026-10-07 Çarşamba, 2026-10-11 Pazar
describe('dates', () => {
  it('ISO haftanın günü: Pazartesi=1, Pazar=7', () => {
    expect(isoWeekday('2026-10-05')).toBe(1)
    expect(isoWeekday('2026-10-07')).toBe(3)
    expect(isoWeekday('2026-10-11')).toBe(7)
  })

  it('haftanın başı pazartesidir (pazar dahil)', () => {
    expect(weekStart('2026-10-07')).toBe('2026-10-05')
    expect(weekStart('2026-10-11')).toBe('2026-10-05')
    expect(weekStart('2026-10-05')).toBe('2026-10-05')
  })

  it('ay ve yıl geçişlerinde gün ekler', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('UTC değil yerel tarihi kullanır (gece 00:30)', () => {
    expect(toDateString(new Date(2026, 9, 8, 0, 30))).toBe('2026-10-08')
  })
})

describe('occursOn', () => {
  it('her gün', () => {
    expect(occursOn(spec({ rule: 'daily' }), '2026-10-11')).toBe(true)
  })

  it('hafta içi: cumartesi ve pazar hariç', () => {
    const s = spec({ rule: 'weekdays' })
    expect(occursOn(s, '2026-10-09')).toBe(true) // cuma
    expect(occursOn(s, '2026-10-10')).toBe(false) // cumartesi
    expect(occursOn(s, '2026-10-11')).toBe(false) // pazar
  })

  it('haftanın seçili günleri ("her salı")', () => {
    const s = spec({ rule: 'weekly', weekdays: [2] })
    expect(occursOn(s, '2026-10-06')).toBe(true)
    expect(occursOn(s, '2026-10-07')).toBe(false)
  })

  it("aylık: 31'i seçilmişse 30 çeken ayda son gün, şubatta 28/29", () => {
    const s = spec({ rule: 'monthly', dayOfMonth: 31 })
    expect(occursOn(s, '2026-10-31')).toBe(true)
    expect(occursOn(s, '2026-11-30')).toBe(true)
    expect(occursOn(s, '2026-11-29')).toBe(false)
    expect(occursOn(s, '2027-02-28')).toBe(true)
    expect(occursOn(s, '2028-02-29')).toBe(true)
  })

  it('başlangıçtan önce, bitişten sonra ve pasifken üretmez', () => {
    expect(occursOn(spec({ startDate: '2026-10-08' }), '2026-10-07')).toBe(false)
    expect(occursOn(spec({ endDate: '2026-10-06' }), '2026-10-07')).toBe(false)
    expect(occursOn(spec({ endDate: '2026-10-07' }), '2026-10-07')).toBe(true)
    expect(occursOn(spec({ active: false }), '2026-10-07')).toBe(false)
  })
})

describe('weekdays', () => {
  it('ayrıştırır, temizler ve sıralar', () => {
    expect(parseWeekdays('1, 3,5')).toEqual([1, 3, 5])
    expect(parseWeekdays('0,8,x,2')).toEqual([2])
    expect(parseWeekdays(null)).toEqual([])
    expect(formatWeekdays([5, 1, 3, 1, 9])).toBe('1,3,5')
    expect(formatWeekdays([])).toBeNull()
  })
})
