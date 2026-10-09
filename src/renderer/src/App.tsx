import * as React from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppShell } from '@/components/app/AppShell'
import { TaskEditor } from '@/components/task/TaskEditor'
import { WaitingDialog } from '@/components/task/WaitingDialog'
import { QuickAddWindow } from '@/components/app/QuickAddWindow'
import { FreeTimeDialog } from '@/components/v2/FreeTimeDialog'
import { BreakdownDialog } from '@/components/v2/BreakdownDialog'
import { PostponeDialog } from '@/components/v2/PostponeDialog'
import { AppProvider, useApp } from '@/lib/app-context'
import { PomodoroProvider } from '@/lib/pomodoro'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { setStorageProfile } from '@/lib/storage'
import type { ProfileInfo } from '../../shared/types'
import { Lock } from 'lucide-react'
import { refreshAll } from '@/lib/data'
import { PageAnalytics, PageAreas, PageFocus, PageInbox, PageMorning, PageNow, PagePlanner, PageSchedule, PageSearch, PageSettings, PageShutdown, PageToday } from './pages'

/** Görev düzenleyici her ekrandan açılabilsin diye tek bir yerde durur */
function GlobalEditor(): React.JSX.Element {
  const { editingTask, closeTask, areas } = useApp()
  return <TaskEditor task={editingTask} areas={areas} open={!!editingTask} onOpenChange={(o) => !o && closeTask()} onSaved={refreshAll} />
}

/** Windows pencere düğmelerinin rengini temaya uydurur */
function TitleBarSync(): null {
  const { settings } = useApp()
  React.useEffect(() => {
    const sync = (): void => {
      const dark = document.documentElement.classList.contains('dark')
      window.api.ui.setTitleBar(dark)
    }
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [settings.theme])
  return null
}

function ThemedToaster(): React.JSX.Element {
  const { settings } = useApp()
  return <Toaster position="bottom-right" theme={settings.theme} richColors={false} closeButton />
}

function NotificationSoundPlayer(): null {
  React.useEffect(() => {
    return window.api.onNotifySound((sound) => {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new Ctx()
        
        let notes: number[] = []
        if (sound === 'chime') notes = [523.25, 659.25]
        else if (sound === 'soft') notes = [440.0]
        else return

        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = sound === 'soft' ? 'sine' : 'triangle'
          osc.frequency.value = freq
          const t = ctx.currentTime + i * 0.15
          gain.gain.setValueAtTime(0, t)
          gain.gain.linearRampToValueAtTime(0.1, t + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
          osc.connect(gain).connect(ctx.destination)
          osc.start(t)
          osc.stop(t + 1)
        })
        setTimeout(() => ctx.close(), 2000)
      } catch {}
    })
  }, [])
  return null
}

/** Giriş yapılmış profilin uygulaması; profil değişince tamamen yeniden kurulur (hiçbir durum taşınmaz) */
function MainApp(): React.JSX.Element {
  return (
    <HashRouter>
      <TooltipProvider delayDuration={400}>
        <AppProvider>
          <PomodoroProvider>
            <AppShell>
              <Routes>
                <Route path="/" element={<PageNow />} />
                <Route path="/today" element={<PageToday />} />
                <Route path="/inbox" element={<PageInbox />} />
                <Route path="/planner" element={<PagePlanner />} />
                <Route path="/schedule" element={<PageSchedule />} />
                <Route path="/areas" element={<PageAreas />} />
                <Route path="/focus" element={<PageFocus />} />
                <Route path="/analytics" element={<PageAnalytics />} />
                <Route path="/search" element={<PageSearch />} />
                <Route path="/settings" element={<PageSettings />} />
                <Route path="/morning" element={<PageMorning />} />
                <Route path="/shutdown" element={<PageShutdown />} />
              </Routes>
            </AppShell>
            <GlobalEditor />
            <WaitingDialog />
            <FreeTimeDialog />
            <BreakdownDialog />
            <PostponeDialog />
            <TitleBarSync />
            <ThemedToaster />
            <NotificationSoundPlayer />
          </PomodoroProvider>
        </AppProvider>
      </TooltipProvider>
    </HashRouter>
  )
}

/** Giriş kapısı: profil yoksa veya kilitliyse giriş ekranı */
function useAuth(): ProfileInfo | null | undefined {
  const [profile, setProfile] = React.useState<ProfileInfo | null | undefined>(undefined)
  React.useEffect(() => {
    window.api.auth.current().then(setProfile, () => setProfile(null))
    return window.api.onAuthChanged(setProfile)
  }, [])
  setStorageProfile(profile?.id ?? null)
  return profile
}

function QuickLocked(): React.JSX.Element {
  React.useEffect(() => {
    document.documentElement.classList.add('quick-window')
  }, [])
  return (
    <div className="flex h-full items-start p-2">
      <div className="surface-hero flex w-full items-center gap-3 !rounded-2xl px-5 py-5 text-[14px]">
        <Lock className="size-5 text-primary" /> Uygulama kilitli. Görev eklemek için önce giriş yap.
        <button type="button" className="ml-auto text-[13px] font-medium text-primary hover:underline" onClick={() => window.api.quick.close()}>
          Kapat
        </button>
      </div>
    </div>
  )
}

export default function App(): React.JSX.Element | null {
  const profile = useAuth()
  const quick = window.location.hash.startsWith('#/quick')
  if (profile === undefined) return null
  // Ctrl+Space ile açılan küçük pencere aynı renderer'ı #/quick ile yükler
  if (quick) {
    return profile ? (
      <AppProvider key={profile.id}>
        <QuickAddWindow />
      </AppProvider>
    ) : (
      <QuickLocked />
    )
  }
  if (!profile) return <LoginScreen onLoggedIn={() => undefined} />
  return <MainApp key={profile.id} />
}
