import { resourcePath } from './window'
import { BrowserWindow, Notification } from 'electron'
import { db } from './db'
import { getSettings } from './repos/settings'
import { listEvents } from './repos/events'
import { listTasks, getTask } from './repos/tasks'
import { activeSession } from './repos/sessions'
import { daySummary } from './repos/stats'
import { getRitual } from './repos/rituals'
import { addDays, today } from '../shared/dates'
import { eventsOn, toMinutes } from '../shared/schedule'

/**
 * Masaüstü hatırlatıcıları. Her 30 saniyede bir bakar:
 *  - saatli görev / ders başlamadan N dk önce ve başladığında
 *  - gün başında günün özeti
 *  - odak oturumu tahmini süreyi aşınca
 * Aynı bildirim notification_log sayesinde bir kez gider (uygulama yeniden açılsa bile).
 */

const ICON = (): string => resourcePath('icon.png')

function alreadySent(key: string): boolean {
  return !!db.prepare('SELECT 1 FROM notification_log WHERE key = ?').get(key)
}

function markSent(key: string): void {
  db.prepare('INSERT OR IGNORE INTO notification_log (key, sent_at) VALUES (?, ?)').run(key, new Date().toISOString())
}

function focusWindow(route: string, taskId: number | null): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  win.webContents.send('navigate', route, taskId)
}

export function notify(title: string, body: string, route = '/', taskId: number | null = null): boolean {
  if (!Notification.isSupported()) return false
  const n = new Notification({ title, body, icon: ICON(), silent: false })
  n.on('click', () => focusWindow(route, taskId))
  n.show()
  return true
}

function once(key: string, send: () => void): void {
  if (alreadySent(key)) return
  markSent(key)
  send()
}

const fmt = (min: number | null): string => {
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? (m ? `${h}s ${m}dk` : `${h} saat`) : `${m} dk`
}

export function checkNotifications(now: Date = new Date()): void {
  const s = getSettings()
  if (!s.notifyEnabled) return
  const date = today(now)
  const minute = now.getHours() * 60 + now.getMinutes()
  const lead = s.notifyLeadMin

  // Gün başı özeti (gün başlangıcından sonraki ilk 3 saat içinde, günde bir kez)
  const dayStart = toMinutes(s.dayStart)
  if (s.notifyMorning && minute >= dayStart && minute < dayStart + 180) {
    once(`morning:${date}`, () => {
      const sum = daySummary(date)
      if (sum.openCount === 0) return
      notify(
        `${now.getHours() < 12 ? 'Günaydın' : 'Merhaba'}! Bugün ${sum.openCount} görev var`,
        `${fmt(sum.remainingMin) || 'Süresiz'} planlı · ${fmt(sum.capacityMin)} kapasite${sum.remainingMin > sum.capacityMin ? ' · plan kapasiteyi aşıyor' : ''}${s.ritualsEnabled && !getRitual(date).morningDoneAt ? ' · Planlamak için tıkla' : ''}`,
        s.ritualsEnabled && !getRitual(date).morningDoneAt ? '/morning' : '/'
      )
    })
  }

  // Gün kapanışı: gün bitişinden 30 dk önce, günde bir kez
  const dayEnd = toMinutes(s.dayEnd)
  if (s.ritualsEnabled && minute >= dayEnd - 30 && minute < dayEnd + 120 && !getRitual(date).shutdownDoneAt) {
    once(`shutdown:${date}`, () => {
      const sum = daySummary(date)
      notify(
        '🌙 Günü kapatma zamanı',
        `${sum.doneCount} görev tamamlandı${sum.openCount ? ` · ${sum.openCount} görev kaldı` : ''}. 1 dakikada kalanları yerleştir, yarına not bırak.`,
        '/shutdown'
      )
    })
  }

  // Saatli görevler
  for (const t of listTasks({ view: 'today', date })) {
    if (!t.scheduledTime || t.scheduledDate !== date || (t.status !== 'planned' && t.status !== 'active')) continue
    const start = toMinutes(t.scheduledTime)
    const base = `task:${t.id}:${date}:${t.scheduledTime}`
    const details = [t.scheduledTime, fmt(t.estimateMin), t.firstStep ? `İlk adım: ${t.firstStep}` : ''].filter(Boolean).join(' · ')
    if (lead > 0 && minute >= start - lead && minute < start) {
      once(`${base}:lead`, () => notify(`⏰ ${start - minute} dk sonra: ${t.title}`, details, '/', t.id))
    }
    if (minute >= start && minute < start + 5) {
      once(`${base}:start`, () => notify(`▶ Başlama zamanı: ${t.title}`, details, '/', t.id))
    }
  }

  // Ders programı
  for (const e of eventsOn(listEvents(), date)) {
    const start = toMinutes(e.startTime)
    const base = `event:${e.id}:${date}`
    const where = [e.location ? `📍 ${e.location}` : '', `${e.startTime}–${e.endTime}`].filter(Boolean).join(' · ')
    if (lead > 0 && minute >= start - lead && minute < start) {
      once(`${base}:lead`, () => notify(`🎓 ${start - minute} dk sonra: ${e.title}`, where, '/'))
    }
    if (minute >= start && minute < start + 5) {
      once(`${base}:start`, () => notify(`🎓 Şimdi: ${e.title}`, where, '/'))
    }
  }

  // Odak oturumu tahmini aştı
  const session = activeSession()
  if (session) {
    const task = getTask(session.taskId)
    if (task?.estimateMin) {
      const elapsed = (now.getTime() - new Date(session.startedAt).getTime()) / 60000 + task.actualMin
      if (elapsed >= task.estimateMin) {
        once(`overrun:${session.id}`, () =>
          notify(`⌛ Tahmini süre doldu: ${task.title}`, `${fmt(task.estimateMin)} planlamıştın. Devam mı, mola mı?`, '/focus', task.id)
        )
      }
    }
  }
}

export function startNotifier(): () => void {
  // Eski kayıtları temizle
  db.prepare('DELETE FROM notification_log WHERE sent_at < ?').run(new Date(Date.parse(addDays(today(), -7))).toISOString())
  const tick = (): void => {
    try {
      checkNotifications()
    } catch (err) {
      console.error('Bildirim kontrolü başarısız', err)
    }
  }
  tick()
  const timer = setInterval(tick, 30_000)
  return () => clearInterval(timer)
}

export function testNotification(): boolean {
  return notify('Control Center', 'Bildirimler çalışıyor. Görev ve derslerden önce burada hatırlatacağım.', '/settings')
}
