import * as React from 'react'
import type { ActiveSession, Area, FixedEvent, ProfileInfo, Settings, Task, TaskContext } from '../../../shared/types'
import type { EstimationProfile } from '../../../shared/estimation'
import { refreshAll, useData } from './data'
import { sget, sset } from './storage'
import { resolveBindings, type Bindings } from '../../../shared/keybindings'
import { DEFAULT_POMODORO } from '../../../shared/pomodoro'

interface AppContextValue {
  areas: Area[]
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  session: ActiveSession | null
  sessionTask: Task | null
  /** Aktif odak oturumu bilgisi en az bir kez yüklendi mi (açılışta yanlış "oturum yok" sanılmasın) */
  sessionLoaded: boolean
  startFocus: (taskId: number) => Promise<void>
  /** Oturumu bitirir, ölçülen dakikayı döner */
  stopFocus: () => Promise<number>
  /** Görev düzenleyiciyi açar (her ekrandan) */
  openTask: (task: Task) => void
  /** "Kaç dakikam var?" — dakika verilirse o süreyle açılır */
  askFreeTime: (minutes?: number) => void
  freeTime: number | null | undefined
  closeFreeTime: () => void
  /** Görev parçalama penceresi */
  askBreakdown: (task: Task) => void
  breakdownTask: Task | null
  closeBreakdown: () => void
  /** 3. ertelemede "neden?" sorusu */
  postponedTask: Task | null
  closePostponed: () => void
  /** "Bekliyor olarak işaretle" penceresini açar */
  askWaiting: (task: Task) => void
  waitingTask: Task | null
  closeWaiting: () => void
  editingTask: Task | null
  closeTask: () => void
  inboxCount: number
  todayCount: number
  /** Ders programı */
  events: FixedEvent[]
  /** Geçerli klavye kısayolları (varsayılan + kullanıcının değiştirdikleri) */
  bindings: Bindings
  /** "Neredesin?" — seçiliyse öneriler bu bağlama göre süzülür */
  currentContext: TaskContext | null
  setCurrentContext: (c: TaskContext | null) => void
  /** Kişisel tahmin çarpanı */
  estimation: EstimationProfile | null
  /** Giriş yapılmış profil */
  profile: ProfileInfo | null
  /** Kilitle: giriş ekranına döner */
  lock: () => Promise<void>
  /** Bugünün görevleri (Şu an / Sırada hesabı için) */
  todayTasks: Task[]
}

const DEFAULT_SETTINGS: Settings = {
  userName: '',
  theme: 'dark',
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

const AppContext = React.createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = React.useContext(AppContext)
  if (!ctx) throw new Error('useApp, AppProvider içinde kullanılmalı')
  return ctx
}

function applyTheme(mode: Settings['theme']): void {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  localStorage.setItem('theme', mode)
}

export function AppProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const areas = useData(() => window.api.areas.list()).data ?? []
  const settingsData = useData(() => window.api.settings.get())
  const settings = settingsData.data ?? DEFAULT_SETTINGS
  // Oturum ve görevi tek seferde yüklenir; ayrı yüklemek yarış durumu yaratıyordu
  const focus = useData(async () => {
    const session = await window.api.sessions.active()
    const task = session ? await window.api.tasks.get(session.taskId) : null
    return { session, task }
  }).data
  const session = focus?.session ?? null
  const sessionTask = focus?.task ?? null
  const inboxCount = useData(() => window.api.tasks.list({ view: 'inbox' }).then((t) => t.length)).data ?? 0
  const todayTasks = useData(() => window.api.tasks.list({ view: 'today' })).data ?? []
  const todayCount = todayTasks.filter((x) => x.status !== 'waiting').length
  const events = useData(() => window.api.events.list()).data ?? []
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  // Bağlam bu cihazda hatırlanır (gün içinde sık değişir; veritabanına gerek yok)
  const [currentContext, setContextState] = React.useState<TaskContext | null>(() => (sget('context') as TaskContext | null) || null)
  const setCurrentContext = React.useCallback((c: TaskContext | null) => {
    setContextState(c)
    sset('context', c)
  }, [])
  const estimation = useData(() => window.api.stats.estimation()).data ?? null
  const profile = useData(() => window.api.auth.current()).data ?? null
  const [waitingTask, setWaitingTask] = React.useState<Task | null>(null)
  // undefined: kapalı · null: açık, süre seçilmemiş · sayı: o süreyle açık
  const [freeTime, setFreeTime] = React.useState<number | null | undefined>(undefined)
  const [breakdownTask, setBreakdownTask] = React.useState<Task | null>(null)
  const [postponedTask, setPostponedTask] = React.useState<Task | null>(null)

  // actions.moveTask, 3. ertelemede bu olayı yayınlar
  React.useEffect(() => {
    const onPostponed = (e: Event): void => setPostponedTask((e as CustomEvent<Task>).detail)
    window.addEventListener('cc:postponed', onPostponed)
    return () => window.removeEventListener('cc:postponed', onPostponed)
  }, [])

  React.useEffect(() => {
    applyTheme(settings.theme)
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.theme])

  const value: AppContextValue = {
    areas,
    settings,
    updateSettings: async (patch) => {
      await window.api.settings.update(patch)
      settingsData.reload()
    },
    session,
    sessionTask,
    sessionLoaded: focus !== undefined,
    startFocus: async (taskId) => {
      await window.api.sessions.start(taskId)
      refreshAll()
    },
    stopFocus: async () => {
      const minutes = await window.api.sessions.stop()
      refreshAll()
      return minutes
    },
    openTask: setEditingTask,
    askWaiting: setWaitingTask,
    askFreeTime: (minutes) => setFreeTime(minutes ?? null),
    freeTime,
    closeFreeTime: () => setFreeTime(undefined),
    askBreakdown: setBreakdownTask,
    breakdownTask,
    closeBreakdown: () => setBreakdownTask(null),
    postponedTask,
    closePostponed: () => setPostponedTask(null),
    waitingTask,
    closeWaiting: () => setWaitingTask(null),
    editingTask,
    closeTask: () => setEditingTask(null),
    inboxCount,
    todayCount,
    events,
    todayTasks,
    bindings: resolveBindings(settings.keybindings),
    currentContext,
    setCurrentContext,
    estimation,
    profile,
    lock: () => window.api.auth.logout()
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
