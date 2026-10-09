import { describe, expect, it } from 'vitest'
import { busyMinutes, eventsOn, inLabel, nowStatus } from './schedule'
import type { FixedEvent, Task } from './types'

let id = 1
const ev = (over: Partial<FixedEvent>): FixedEvent => ({
  id: id++,
  title: 'Veri Yapıları',
  areaId: 1,
  weekday: 3,
  startTime: '09:00',
  endTime: '11:00',
  location: 'B-204',
  validFrom: null,
  validTo: null,
  countsAgainstCapacity: true,
  ...over
})

const task = (over: Partial<Task>): Task =>
  ({
    id: id++,
    title: 'Ödev',
    status: 'planned',
    scheduledDate: '2026-10-07',
    scheduledTime: null,
    estimateMin: 60,
    areaId: null,
    ...over
  }) as Task

// 2026-10-07 Çarşamba (weekday 3)
const D = '2026-10-07'

describe('eventsOn', () => {
  it('haftanın gününe ve dönem aralığına göre süzer', () => {
    const list = [ev({}), ev({ weekday: 1 }), ev({ validTo: '2026-10-01' }), ev({ validFrom: '2026-11-01' }), ev({ startTime: '08:00', endTime: '08:50' })]
    expect(eventsOn(list, D).map((e) => e.startTime)).toEqual(['08:00', '09:00'])
  })
})

describe('busyMinutes', () => {
  it('çakışanları birleştirir, kapasiteye sayılmayanları atlar', () => {
    const list = [
      ev({ startTime: '09:00', endTime: '11:00' }),
      ev({ startTime: '10:00', endTime: '12:00' }),
      ev({ startTime: '14:00', endTime: '15:00' }),
      ev({ startTime: '16:00', endTime: '18:00', countsAgainstCapacity: false })
    ]
    expect(busyMinutes(list, D)).toBe(180 + 60)
  })
})

describe('nowStatus', () => {
  const events = [ev({ startTime: '09:00', endTime: '11:00' }), ev({ title: 'Lab', startTime: '14:00', endTime: '16:00', location: 'Lab-3' })]
  const tasks = [task({ title: 'Ödev', scheduledTime: '12:00', estimateMin: 45 })]

  it('derste: dersin adı, yeri ve bitişi', () => {
    const s = nowStatus(events, tasks, D, 9 * 60 + 30)
    expect(s).toMatchObject({ kind: 'event', title: 'Veri Yapıları', location: 'B-204', until: '11:00' })
    expect(s.next).toMatchObject({ kind: 'task', title: 'Ödev', start: '12:00', inMin: 150 })
  })

  it('görev bloğunda', () => {
    expect(nowStatus(events, tasks, D, 12 * 60 + 10)).toMatchObject({ kind: 'task', title: 'Ödev', until: '12:45' })
  })

  it('boşta: sıradaki şey ve ne zamana kadar boş', () => {
    const s = nowStatus(events, tasks, D, 11 * 60 + 15)
    expect(s).toMatchObject({ kind: 'free', freeUntil: '12:00' })
    expect(s.next?.inMin).toBe(45)
  })

  it('gün bitti', () => {
    expect(nowStatus(events, tasks, D, 20 * 60)).toEqual({ kind: 'free', next: null, freeUntil: null })
  })
})

describe('inLabel', () => {
  it('okunur süre', () => {
    expect(inLabel(5)).toBe('5 dk sonra')
    expect(inLabel(60)).toBe('1 saat sonra')
    expect(inLabel(80)).toBe('1s 20dk sonra')
  })
})
