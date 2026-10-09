import { describe, expect, it } from 'vitest'
import { inRange, parseSearchIntent, sanitizeIntent } from './semantic'
import { computeStreak, type RecurrenceSpec } from './recurrence'

// 9 Ekim 2026 Cuma
const T = '2026-10-09'

describe('parseSearchIntent', () => {
  it('dolgu sözcüklerini atar, tarih ifadesini aralığa çevirir', () => {
    expect(parseSearchIntent('geçen ayki vergi işi', T)).toEqual({ keywords: ['vergi'], from: '2026-09-01', to: '2026-09-30' })
  })
  it('bu hafta / dün', () => {
    expect(parseSearchIntent('bu hafta Proje', T)).toMatchObject({ keywords: ['proje'], from: '2026-10-05', to: '2026-10-11' })
    expect(parseSearchIntent('dünkü rapor', T)).toMatchObject({ keywords: ['rapor'], from: '2026-10-08', to: '2026-10-08' })
  })
  it('Türkçe karakter duyarsız, tarih yoksa aralık yok', () => {
    expect(parseSearchIntent('Müşteri Raporu', T)).toEqual({ keywords: ['musteri', 'raporu'], from: null, to: null })
  })
  it('ocakta "geçen ay" önceki yılın aralığı', () => {
    expect(parseSearchIntent('geçen ay', '2026-01-15')).toEqual({ keywords: [], from: '2025-12-01', to: '2025-12-31' })
  })
})

describe('sanitizeIntent', () => {
  it('yapay zekadan gelen geçersiz alanları atar', () => {
    expect(sanitizeIntent({ keywords: ['Vergi', 42, "x'; DROP TABLE tasks;--"], from: '2026-09-01', to: 'dün' })).toEqual({
      keywords: ['vergi', 'drop', 'table', 'tasks'],
      from: '2026-09-01',
      to: null
    })
    expect(sanitizeIntent('SELECT *')).toBeNull()
    expect(sanitizeIntent({ keywords: 'vergi' })).toBeNull()
  })
})

describe('inRange', () => {
  const task = { scheduledDate: null, completedAt: null, createdAt: '2026-09-15T10:00:00.000Z' }
  it('planlandığı, bittiği ya da eklendiği gün aralıktaysa', () => {
    expect(inRange(task, '2026-09-01', '2026-09-30')).toBe(true)
    expect(inRange(task, '2026-10-01', '2026-10-31')).toBe(false)
    expect(inRange({ ...task, scheduledDate: '2026-10-02' }, '2026-10-01', '2026-10-31')).toBe(true)
    expect(inRange(task, null, null)).toBe(true)
  })
})

describe('computeStreak', () => {
  const daily: RecurrenceSpec = { rule: 'daily', weekdays: [], dayOfMonth: null, startDate: '2026-10-01', endDate: null, active: true }
  const set = (...d: string[]): Set<string> => new Set(d)
  it('arka arkaya günleri sayar; bugün henüz yapılmadıysa zincir bozulmaz', () => {
    expect(computeStreak(daily, set('2026-10-06', '2026-10-07', '2026-10-08'), T)).toEqual({ current: 3, longest: 3 })
    expect(computeStreak(daily, set('2026-10-06', '2026-10-07', '2026-10-08', T), T)).toEqual({ current: 4, longest: 4 })
  })
  it('kaçırılan gün zinciri sıfırlar, en uzun kalır', () => {
    expect(computeStreak(daily, set('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-07', '2026-10-08'), T)).toEqual({ current: 2, longest: 4 })
    expect(computeStreak(daily, set('2026-10-01', '2026-10-02'), T)).toEqual({ current: 0, longest: 2 })
  })
  it('haftalık kuralda aradaki günler zinciri bozmaz', () => {
    // Pazartesi + Perşembe; 9 Ekim Cuma
    const weekly: RecurrenceSpec = { ...daily, rule: 'weekly', weekdays: [1, 4] }
    expect(computeStreak(weekly, set('2026-10-01', '2026-10-05', '2026-10-08'), T)).toEqual({ current: 3, longest: 3 })
  })
})
