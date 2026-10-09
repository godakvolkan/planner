import { describe, expect, it } from 'vitest'
import { rankTasks, suggestBalance } from './planning'
import type { Task } from './types'

let nextId = 1
const task = (over: Partial<Task>): Task => ({
  id: nextId++,
  title: 'görev',
  notes: null,
  areaId: null,
  status: 'planned',
  priority: 1,
  deadline: null,
  scheduledDate: '2026-10-07',
  scheduledTime: null,
  plannedWeek: null,
  estimateMin: 30,
  firstStep: null,
  firstStepTarget: null,
  firstStepType: null,
  top3Date: null,
  postponeCount: 0,
  parentId: null,
  recurrenceId: null,
  waitingFor: null,
  followUpDate: null,
  createdAt: '2026-10-07T08:00:00Z',
  completedAt: null,
  tags: [],
  subtaskCount: 0,
  subtaskDoneCount: 0,
  actualMin: 0,
  energyLevel: null,
  context: null,
  ...over
})

const ctx = (minuteOfDay: number, activeTaskId: number | null = null) => ({ date: '2026-10-07', minuteOfDay, activeTaskId })

describe('rankTasks (Şimdi ne?)', () => {
  it('çalışan oturumun görevi her zaman ilk', () => {
    const a = task({ priority: 4, top3Date: '2026-10-07' })
    const b = task({ priority: 1 })
    expect(rankTasks([a, b], ctx(600, b.id))[0].id).toBe(b.id)
  })

  it('içinde bulunduğumuz zaman bloğu, Bugünün 3’ünün önüne geçer', () => {
    const top = task({ top3Date: '2026-10-07', priority: 4 })
    const block = task({ scheduledTime: '10:00', estimateMin: 60 })
    expect(rankTasks([top, block], ctx(10 * 60 + 15))[0].id).toBe(block.id)
  })

  it('ileri saate planlı görev, o saate kadar geri durur', () => {
    const later = task({ scheduledTime: '16:00', priority: 4 })
    const now = task({ priority: 1 })
    expect(rankTasks([later, now], ctx(9 * 60))[0].id).toBe(now.id)
  })

  it("Bugünün 3'ü > yakın deadline > öncelik", () => {
    const p4 = task({ priority: 4 })
    const dl = task({ deadline: '2026-10-08' })
    const top = task({ top3Date: '2026-10-07' })
    expect(rankTasks([p4, dl, top], ctx(600)).map((t) => t.id)).toEqual([top.id, dl.id, p4.id])
  })

  it('bitmiş ve bekleyen görevleri dışarıda bırakır', () => {
    const done = task({ status: 'done' })
    const waiting = task({ status: 'waiting' })
    expect(rankTasks([done, waiting], ctx(600))).toEqual([])
  })
})

describe('suggestBalance (Günü dengele)', () => {
  it('kapasite yetiyorsa öneri yok', () => {
    expect(suggestBalance([task({ estimateMin: 60 })], 120, ctx(600))).toEqual([])
  })

  it('önce düşük öncelikli ve büyük görevleri önerir, kapasiteye inince durur', () => {
    const big = task({ estimateMin: 120, priority: 1 })
    const small = task({ estimateMin: 30, priority: 1 })
    const important = task({ estimateMin: 120, priority: 3 })
    const s = suggestBalance([big, small, important], 150, ctx(600))
    expect(s.map((x) => x.task.id)).toEqual([big.id])
  })

  it("Bugünün 3'ü, saatli blok ve yakın deadline korunur", () => {
    const top = task({ estimateMin: 200, top3Date: '2026-10-07' })
    const block = task({ estimateMin: 200, scheduledTime: '14:00' })
    const due = task({ estimateMin: 200, deadline: '2026-10-08' })
    expect(suggestBalance([top, block, due], 60, ctx(600))).toEqual([])
  })

  it('tahmini olmayan görev 30 dk sayılır', () => {
    const a = task({ estimateMin: null })
    const b = task({ estimateMin: null })
    expect(suggestBalance([a, b], 30, ctx(600))).toHaveLength(1)
  })
})
