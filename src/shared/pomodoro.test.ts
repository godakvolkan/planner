import { describe, expect, it } from 'vitest'
import { DEFAULT_POMODORO, advance, cycleIndex, isRunning, pause, remainingSec, resume, startPomodoro } from './pomodoro'

const c = DEFAULT_POMODORO
const T0 = 1_000_000

describe('pomodoro', () => {
  it('25 dk odakla başlar, zaman akar', () => {
    const s = startPomodoro(7, c, T0)
    expect(s).toMatchObject({ phase: 'work', durationSec: 1500, completedWork: 0 })
    expect(remainingSec(s, T0 + 60_000)).toBe(1440)
    expect(remainingSec(s, T0 + 2_000_000)).toBe(0)
  })

  it('duraklat / devam kalan süreyi korur', () => {
    let s = startPomodoro(1, c, T0)
    s = pause(s, T0 + 600_000) // 10 dk sonra
    expect(isRunning(s)).toBe(false)
    expect(remainingSec(s, T0 + 9_000_000)).toBe(900) // duraklıyken azalmaz
    s = resume(s, T0 + 9_000_000)
    expect(remainingSec(s, T0 + 9_060_000)).toBe(840)
  })

  it('odak → kısa mola (kendiliğinden) → odak (bekler)', () => {
    let s = startPomodoro(1, c, T0)
    s = advance(s, c, T0 + 1_500_000)
    expect(s).toMatchObject({ phase: 'short', completedWork: 1, durationSec: 300, waiting: false })
    s = advance(s, c, T0 + 1_800_000)
    expect(s).toMatchObject({ phase: 'work', waiting: true })
    expect(remainingSec(s, T0 + 5_000_000)).toBe(1500) // beklerken saymaz
    s = resume(s, T0 + 5_000_000)
    expect(isRunning(s)).toBe(true)
  })

  it('4. odaktan sonra uzun mola; tur sayacı', () => {
    let s = startPomodoro(1, c, T0)
    const phases: string[] = []
    for (let i = 0; i < 8; i++) {
      s = advance(s, c, T0)
      phases.push(s.phase)
    }
    expect(phases).toEqual(['short', 'work', 'short', 'work', 'short', 'work', 'long', 'work'])
    expect(s.completedWork).toBe(4)
    expect(cycleIndex(s, c)).toBe(1) // yeni seri
  })

  it('ayarlar: kendiliğinden mola kapalıysa bekler', () => {
    const cfg = { ...c, autoStartBreak: false, workMin: 50, shortMin: 10 }
    const s = advance(startPomodoro(1, cfg, T0), cfg, T0)
    expect(s).toMatchObject({ phase: 'short', waiting: true, durationSec: 600 })
  })
})
