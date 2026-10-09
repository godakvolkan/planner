import { describe, expect, it } from 'vitest'
import { fitToTime, isLarge, spreadOverDays, suggestBreakdown } from './v2'
import { energyFit, rankTasks } from './planning'
import { addDays } from './dates'
import type { Task } from './types'

let id = 1
const task = (over: Partial<Task>): Task =>
  ({
    id: id++,
    title: 'görev',
    status: 'planned',
    priority: 1,
    scheduledDate: '2026-10-07',
    scheduledTime: null,
    estimateMin: 30,
    top3Date: null,
    deadline: null,
    postponeCount: 0,
    subtaskCount: 0,
    energyLevel: null,
    ...over
  }) as Task

const ctx = { date: '2026-10-07', minuteOfDay: 600, activeTaskId: null }

describe('fitToTime (Kaç dakikam var?)', () => {
  it('süreye sığan en değerli kombinasyon, süreyi aşmaz', () => {
    const big = task({ title: 'büyük', estimateMin: 60, priority: 4 })
    const a = task({ title: 'a', estimateMin: 10 })
    const b = task({ title: 'b', estimateMin: 15 })
    const c = task({ title: 'c', estimateMin: 5 })
    const plan = fitToTime([big, a, b, c], 30, ctx)
    expect(plan.totalMin).toBeLessThanOrEqual(30)
    expect(plan.tasks.map((t) => t.title).sort()).toEqual(['a', 'b', 'c'])
    expect(plan.freeMin).toBe(0)
  })

  it('2 saatte büyük ve önemli işi de alır', () => {
    const big = task({ title: 'TÜBİTAK', estimateMin: 60, priority: 4 })
    const mid = task({ title: 'kodlama', estimateMin: 45, priority: 3 })
    const mail = task({ title: 'mail', estimateMin: 15 })
    const plan = fitToTime([mail, mid, big], 120, ctx)
    expect(plan.tasks.map((t) => t.title)).toEqual(['TÜBİTAK', 'kodlama', 'mail'])
    expect(plan.totalMin).toBe(120)
  })

  it('başka saate planlı blokları karıştırmaz, hiçbir şey sığmazsa boş', () => {
    const later = task({ estimateMin: 15, scheduledTime: '16:00' })
    const huge = task({ estimateMin: 180 })
    expect(fitToTime([later, huge], 30, ctx).tasks).toEqual([])
  })
})

describe('enerji', () => {
  it('düşük enerjide küçük işler öne geçer, yüksekte büyükler', () => {
    const small = task({ title: 'küçük', estimateMin: 15 })
    const big = task({ title: 'büyük', estimateMin: 120 })
    expect(rankTasks([big, small], ctx, 'low')[0].title).toBe('küçük')
    expect(rankTasks([small, big], ctx, 'high')[0].title).toBe('büyük')
  })
  it("Bugünün 3'ü ve zaman bloğu enerjiden güçlüdür", () => {
    const top = task({ estimateMin: 120, top3Date: '2026-10-07' })
    const small = task({ estimateMin: 10 })
    expect(rankTasks([small, top], ctx, 'low')[0].id).toBe(top.id)
  })
  it('görevin kendi enerji etiketi süreden önce gelir', () => {
    expect(energyFit(task({ estimateMin: 120, energyLevel: 'low' }), 'low')).toBeGreaterThan(0)
    expect(energyFit(task({ estimateMin: 10 }), 'medium')).toBe(0)
  })
})

describe('suggestBreakdown', () => {
  it('rapor şablonu, toplam süre korunur (±5 dk)', () => {
    const steps = suggestBreakdown('TÜBİTAK 2209 sonuç raporu', 180)
    expect(steps[0].title).toMatch(/Kaynak/)
    const total = steps.reduce((a, s) => a + s.estimateMin, 0)
    expect(Math.abs(total - 180)).toBeLessThanOrEqual(10)
    expect(steps.every((s) => s.estimateMin % 5 === 0)).toBe(true)
  })
  it('ödev ve kod şablonları', () => {
    expect(suggestBreakdown('Veri yapıları ödevi', 90)[0].title).toMatch(/yönerge/)
    expect(suggestBreakdown('NestJS API yaz', 120).some((s) => s.title === 'Test et')).toBe(true)
  })
  it('şablon yoksa çalışma bloklarına böler', () => {
    const steps = suggestBreakdown('Garajı topla', 120)
    expect(steps[0].title).toMatch(/ilk adım/)
    expect(steps.filter((s) => s.title.startsWith('Çalışma bloğu')).length).toBe(2)
  })
  it('isLarge: 90 dk üstü veya çok ertelenmiş, alt görevi yok', () => {
    expect(isLarge(task({ estimateMin: 120 }))).toBe(true)
    expect(isLarge(task({ estimateMin: 30, postponeCount: 2 }))).toBe(true)
    expect(isLarge(task({ estimateMin: 120, subtaskCount: 3 }))).toBe(false)
  })
})

describe('spreadOverDays', () => {
  const steps = [30, 30, 30, 30, 30].map((m, i) => ({ title: `adım ${i}`, estimateMin: m }))
  it('günlük kapasitenin yarısını aşmadan dağıtır', () => {
    const r = spreadOverDays(steps, '2026-10-07', () => 120, addDays)
    expect(r.map((x) => x.date)).toEqual(['2026-10-07', '2026-10-07', '2026-10-08', '2026-10-08', '2026-10-09'])
  })
  it('kapasitesi 0 olan günü atlar', () => {
    const r = spreadOverDays(steps.slice(0, 3), '2026-10-07', (d) => (d === '2026-10-08' ? 0 : 60), addDays)
    expect(r.map((x) => x.date)).toEqual(['2026-10-07', '2026-10-09', '2026-10-10'])
  })
  it('teslim tarihini geçmez', () => {
    const r = spreadOverDays(steps, '2026-10-07', () => 60, addDays, '2026-10-08')
    expect(r.every((x) => x.date <= '2026-10-08')).toBe(true)
  })
})
