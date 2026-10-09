import * as React from 'react'
import { toast } from 'sonner'
import {
  BREAK_TIPS,
  PHASE_LABEL,
  advance,
  isRunning,
  pause as pausePhase,
  remainingSec,
  resume as resumePhase,
  startPomodoro,
  type PomodoroConfig,
  type PomodoroState
} from '../../../shared/pomodoro'
import { useApp } from './app-context'
import { refreshAll } from './data'
import { sget, sset } from './storage'


interface PomodoroValue {
  state: PomodoroState | null
  config: PomodoroConfig
  /** Kalan saniye (her saniye güncellenir) */
  remaining: number
  start: (taskId: number) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  /** Bu fazı bitir, sıradakine geç */
  skip: () => Promise<void>
  /** Pomodoro'yu tamamen kapat */
  stop: () => Promise<void>
  tip: string
}

const PomodoroContext = React.createContext<PomodoroValue | null>(null)

export function usePomodoro(): PomodoroValue {
  const ctx = React.useContext(PomodoroContext)
  if (!ctx) throw new Error('usePomodoro, PomodoroProvider içinde kullanılmalı')
  return ctx
}

function load(): PomodoroState | null {
  try {
    const raw = sget('pomodoro')
    return raw ? (JSON.parse(raw) as PomodoroState) : null
  } catch {
    return null
  }
}

const save = (s: PomodoroState | null): void => sset('pomodoro', s ? JSON.stringify(s) : null)

/** Web Audio ile kısa, yumuşak bir zil (dosya gerekmez) */
function chime(kind: 'break' | 'work'): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const notes = kind === 'break' ? [659.25, 523.25, 392.0] : [392.0, 523.25, 659.25]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 1)
    })
    setTimeout(() => ctx.close(), 2000)
  } catch {
    // ses çalınamazsa sessiz devam
  }
}

export function PomodoroProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { settings, session, sessionLoaded, startFocus, stopFocus } = useApp()
  const config = settings.pomodoro
  const [state, setStateRaw] = React.useState<PomodoroState | null>(load)
  const [now, setNow] = React.useState(() => Date.now())
  const [tip, setTip] = React.useState(BREAK_TIPS[0])
  const stateRef = React.useRef(state)
  stateRef.current = state
  const transitioning = React.useRef(false)

  const setState = React.useCallback((s: PomodoroState | null) => {
    stateRef.current = s
    setStateRaw(s)
    save(s)
  }, [])

  // Saniyelik sayaç (sadece Pomodoro varken)
  React.useEffect(() => {
    if (!state) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [state])

  // Görev başka bir yerden tamamlanır / odak başka göreve geçerse Pomodoro'yu kapat
  React.useEffect(() => {
    const s = stateRef.current
    if (!sessionLoaded || transitioning.current || !s || s.phase !== 'work' || !isRunning(s)) return
    if (session && session.taskId !== s.taskId) setState(null)
    // Oturum dışarıdan durdurulduysa (ör. kenar çubuğundan ya da tepsiden duraklat) Pomodoro da duraklar
    else if (!session) setState(pausePhase(s, Date.now()))
  }, [session, sessionLoaded, setState])

  const remaining = state ? Math.ceil(remainingSec(state, now)) : 0

  // Faz bitişi
  React.useEffect(() => {
    const s = stateRef.current
    if (!s || !isRunning(s) || remaining > 0 || transitioning.current) return
    transitioning.current = true
    ;(async () => {
      try {
        const next = advance(s, config, Date.now())
        if (s.phase === 'work') {
          await stopFocus()
          const t = BREAK_TIPS[Math.floor(Math.random() * BREAK_TIPS.length)]
          setTip(t)
          window.api.notify.show(
            next.phase === 'long' ? '🌿 Uzun mola zamanı' : '☕ Mola zamanı',
            `${s.completedWork + 1}. odak turu bitti. ${Math.round(next.durationSec / 60)} dk mola: ${t}`,
            '/focus'
          )
          if (settings.pomodoroSound) chime('break')
        } else {
          window.api.notify.show('🎯 Odak zamanı', next.waiting ? 'Hazır olduğunda yeni turu başlat.' : `${config.workMin} dakikalık yeni tur başladı.`, '/focus')
          if (settings.pomodoroSound) chime('work')
          if (!next.waiting) await startFocus(s.taskId)
        }
        setState(next)
        refreshAll()
      } finally {
        transitioning.current = false
      }
    })()
  }, [remaining, config, settings.pomodoroSound, startFocus, stopFocus, setState])

  const value: PomodoroValue = {
    state,
    config,
    remaining,
    tip,
    start: async (taskId) => {
      await startFocus(taskId)
      setState(startPomodoro(taskId, config, Date.now()))
      setNow(Date.now())
    },
    pause: async () => {
      const s = stateRef.current
      if (!s) return
      if (s.phase === 'work') await stopFocus()
      setState(pausePhase(s, Date.now()))
    },
    resume: async () => {
      const s = stateRef.current
      if (!s) return
      if (s.phase === 'work') await startFocus(s.taskId)
      setState(resumePhase(s, Date.now()))
      setNow(Date.now())
    },
    skip: async () => {
      const s = stateRef.current
      if (!s) return
      if (s.phase === 'work' && isRunning(s)) await stopFocus()
      const next = advance(s, config, Date.now())
      if (next.phase === 'work' && !next.waiting) await startFocus(s.taskId)
      if (next.phase !== 'work') setTip(BREAK_TIPS[Math.floor(Math.random() * BREAK_TIPS.length)])
      setState(next)
      setNow(Date.now())
      toast(`${PHASE_LABEL[s.phase]} atlandı`, { description: `Sırada: ${PHASE_LABEL[next.phase]}` })
    },
    stop: async () => {
      const s = stateRef.current
      if (s?.phase === 'work' && isRunning(s)) await stopFocus()
      setState(null)
    }
  }

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>
}
