/**
 * Pomodoro durum makinesi (saf; zamanı dışarıdan alır, test edilebilir).
 * Odak → kısa mola → odak → … → her N odakta bir uzun mola.
 */

export type PomodoroPhase = 'work' | 'short' | 'long'

export interface PomodoroConfig {
  workMin: number
  shortMin: number
  longMin: number
  /** Kaç odak turundan sonra uzun mola */
  cyclesBeforeLong: number
  /** Mola bitince bir sonraki odak kendiliğinden başlasın mı */
  autoStartWork: boolean
  /** Odak bitince mola kendiliğinden başlasın mı */
  autoStartBreak: boolean
}

export const DEFAULT_POMODORO: PomodoroConfig = {
  workMin: 25,
  shortMin: 5,
  longMin: 15,
  cyclesBeforeLong: 4,
  autoStartWork: false,
  autoStartBreak: true
}

export interface PomodoroState {
  taskId: number
  phase: PomodoroPhase
  /** Faz çalışıyorsa başlangıç (ms); duraklatılmışsa null */
  startedAt: number | null
  /** Bu fazın toplam süresi (sn) */
  durationSec: number
  /** Duraklatılmışken kalan süre (sn) */
  pausedRemainingSec: number | null
  /** Tamamlanan odak turu sayısı */
  completedWork: number
  /** Faz bitti, kullanıcının "başlat" demesi bekleniyor */
  waiting: boolean
}

export const phaseMinutes = (phase: PomodoroPhase, c: PomodoroConfig): number =>
  phase === 'work' ? c.workMin : phase === 'short' ? c.shortMin : c.longMin

export function startPomodoro(taskId: number, c: PomodoroConfig, now: number): PomodoroState {
  return { taskId, phase: 'work', startedAt: now, durationSec: c.workMin * 60, pausedRemainingSec: null, completedWork: 0, waiting: false }
}

export function remainingSec(s: PomodoroState, now: number): number {
  if (s.waiting) return s.durationSec
  if (s.startedAt === null) return Math.max(0, s.pausedRemainingSec ?? s.durationSec)
  return Math.max(0, s.durationSec - (now - s.startedAt) / 1000)
}

export const isRunning = (s: PomodoroState): boolean => s.startedAt !== null && !s.waiting

export function pause(s: PomodoroState, now: number): PomodoroState {
  if (!isRunning(s)) return s
  return { ...s, startedAt: null, pausedRemainingSec: remainingSec(s, now) }
}

export function resume(s: PomodoroState, now: number): PomodoroState {
  if (s.waiting) return { ...s, waiting: false, startedAt: now, pausedRemainingSec: null }
  if (s.startedAt !== null) return s
  const rem = s.pausedRemainingSec ?? s.durationSec
  // Kalan süre korunur: başlangıcı geriye kaydır
  return { ...s, startedAt: now - (s.durationSec - rem) * 1000, pausedRemainingSec: null }
}

/** Sıradaki faz (süre dolunca veya "atla" ile). Odak sayılır sadece süre dolunca ya da atlanınca. */
export function advance(s: PomodoroState, c: PomodoroConfig, now: number): PomodoroState {
  if (s.phase === 'work') {
    const completedWork = s.completedWork + 1
    const phase: PomodoroPhase = completedWork % c.cyclesBeforeLong === 0 ? 'long' : 'short'
    return {
      ...s,
      phase,
      completedWork,
      durationSec: phaseMinutes(phase, c) * 60,
      pausedRemainingSec: null,
      waiting: !c.autoStartBreak,
      startedAt: c.autoStartBreak ? now : null
    }
  }
  return {
    ...s,
    phase: 'work',
    durationSec: c.workMin * 60,
    pausedRemainingSec: null,
    waiting: !c.autoStartWork,
    startedAt: c.autoStartWork ? now : null
  }
}

/** Şu anki tur: 1…cyclesBeforeLong (mola sırasında az önce biten tur) */
export function cycleIndex(s: PomodoroState, c: PomodoroConfig): number {
  const done = s.phase === 'work' ? s.completedWork : s.completedWork - 1
  return (((done % c.cyclesBeforeLong) + c.cyclesBeforeLong) % c.cyclesBeforeLong) + 1
}

export const PHASE_LABEL: Record<PomodoroPhase, string> = { work: 'Odak', short: 'Kısa mola', long: 'Uzun mola' }

export const BREAK_TIPS = [
  'Kalk, biraz yürü.',
  'Bir bardak su iç.',
  'Pencereden uzağa bak; gözlerin dinlensin.',
  'Omuzlarını ve boynunu esnet.',
  'Derin bir nefes al, yavaşça ver.',
  'Telefona değil, odaya bak.'
]
