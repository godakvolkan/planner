import { resourcePath } from './window'
import { app, BrowserWindow, globalShortcut, Menu, nativeImage, screen, Tray } from 'electron'
import { join } from 'path'
import { activeSession, startSession, stopSession } from './repos/sessions'
import { getTask, listTasks } from './repos/tasks'
import { getSettings } from './repos/settings'
import { daySummary } from './repos/stats'
import { rankTasks } from '../shared/planning'
import { today } from '../shared/dates'
import type { ShortcutStatus } from '../shared/types'
import { formatCombo, resolveBindings } from '../shared/keybindings'
import { isLoggedIn } from './auth'

/**
 * Masaüstü entegrasyonu: sistem tepsisi, her yerden hızlı ekleme penceresi, global kısayollar.
 */

// Yollar uygulama köküne göre: geliştirmede proje klasörü, paketli sürümde app.asar
const appRoot = (): string => app.getAppPath()
const ICON = (): string => resourcePath('icon.png')
let tray: Tray | null = null
let quickWin: BrowserWindow | null = null
let quitting = false
let shortcut: ShortcutStatus = { quickAdd: null, error: null }

export const isQuitting = (): boolean => quitting
export const markQuitting = (): void => {
  quitting = true
}

export function mainWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows().find((w) => w !== quickWin && !w.isDestroyed())
}

export function showMain(route?: string): void {
  const win = mainWindow()
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  if (route) win.webContents.send('navigate', route, null)
}

export function broadcastChange(): void {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('data:changed')
  refreshTray()
}

// ---------------------------------------------------------------- hızlı ekleme penceresi

function createQuickWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 640,
    height: 132,
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    webPreferences: { preload: join(appRoot(), 'out/preload/index.js'), contextIsolation: true, nodeIntegration: false }
  })
  win.on('blur', () => win.hide())
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/quick`)
  else win.loadFile(join(appRoot(), 'out/renderer/index.html'), { hash: '/quick' })
  return win
}

export function toggleQuickAdd(): void {
  // Kilitliyken görev eklenemez: ana pencere (giriş ekranı) açılır
  if (!isLoggedIn()) return showMain()
  if (!quickWin || quickWin.isDestroyed()) quickWin = createQuickWindow()
  if (quickWin.isVisible()) return quickWin.hide()
  // İmlecin bulunduğu ekranın üst üçte birine yerleş
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width, height } = display.workArea
  const [w] = quickWin.getSize()
  quickWin.setPosition(Math.round(x + (width - w) / 2), Math.round(y + height * 0.22))
  const show = (): void => {
    quickWin!.show()
    quickWin!.focus()
    quickWin!.webContents.send('quick:shown')
  }
  if (quickWin.webContents.isLoading()) quickWin.webContents.once('did-finish-load', show)
  else show()
}

export function hideQuickAdd(): void {
  quickWin?.hide()
}

// ---------------------------------------------------------------- global kısayollar

export function registerShortcuts(): ShortcutStatus {
  globalShortcut.unregisterAll()
  const bindings = resolveBindings(getSettings().keybindings)
  const wanted = bindings.quickAdd
  // İstenen kısayol başka bir program tarafından tutuluyorsa yedeklere düş
  const candidates = [...new Set([wanted, 'Control+Shift+Space', 'Alt+Shift+N'])]
  shortcut = { quickAdd: null, error: null }
  for (const acc of candidates) {
    try {
      if (globalShortcut.register(acc, toggleQuickAdd)) {
        shortcut = {
          quickAdd: acc,
          error: acc === wanted ? null : `${formatCombo(wanted)} başka bir uygulama tarafından kullanılıyor; şimdilik ${formatCombo(acc)} çalışıyor.`
        }
        break
      }
    } catch {
      // geçersiz accelerator: sıradakini dene
    }
  }
  if (!shortcut.quickAdd) shortcut.error = 'Hızlı ekleme kısayolu kaydedilemedi.'
  try {
    if (!globalShortcut.register(bindings.focusGlobal, () => showMain('/focus'))) {
      shortcut.error = [shortcut.error, `${formatCombo(bindings.focusGlobal)} (Focus) başka bir uygulama tarafından kullanılıyor.`].filter(Boolean).join(' ')
    }
  } catch {
    shortcut.error = [shortcut.error, 'Focus kısayolu geçersiz.'].filter(Boolean).join(' ')
  }
  refreshTray()
  return shortcut
}

/** Ayarlarda yeni kısayol kaydedilirken basılan tuşlar global kısayolu tetiklemesin */
export function suspendShortcuts(paused: boolean): ShortcutStatus {
  if (paused) {
    globalShortcut.unregisterAll()
    return shortcut
  }
  return registerShortcuts()
}

export const shortcutStatus = (): ShortcutStatus => shortcut

// ---------------------------------------------------------------- sistem tepsisi

const clock = (sec: number): string => {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${m}:${ss}` : `${m}:${ss}`
}

function lockedMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: '🔒  Kilitli', enabled: false },
    { label: 'Giriş yap', click: () => showMain() },
    { type: 'separator' },
    { label: 'Çıkış', click: () => { quitting = true; app.quit() } }
  ])
}

function buildMenu(): Menu {
  if (!isLoggedIn()) return lockedMenu()
  const session = activeSession()
  const task = session ? getTask(session.taskId) : null
  const date = today()
  const todays = listTasks({ view: 'today' }).filter((t) => t.status === 'planned' || t.status === 'active')
  const now = new Date()
  const suggested = rankTasks(todays, { date, minuteOfDay: now.getHours() * 60 + now.getMinutes(), activeTaskId: null }, daySummary(date).energy)[0]
  const label = shortcut.quickAdd ? shortcut.quickAdd.replace('Control', 'Ctrl') : undefined

  const items: Electron.MenuItemConstructorOptions[] = []
  if (session && task) {
    const elapsed = (Date.now() - Date.parse(session.startedAt)) / 1000 + task.actualMin * 60
    items.push(
      { label: `🟢 ${task.title}`, enabled: false },
      { label: `    ${clock(elapsed)}${task.estimateMin ? ` / ${task.estimateMin} dk` : ''}`, enabled: false },
      { label: '⏸  Odağı duraklat', click: () => { stopSession(); broadcastChange() } },
      { label: '🎯  Odak ekranını aç', click: () => showMain('/focus') },
      { type: 'separator' }
    )
  } else if (suggested) {
    items.push(
      { label: `Sıradaki: ${suggested.title}`, enabled: false },
      { label: '▶  Odaklanmaya başla', click: () => { startSession(suggested.id); broadcastChange(); showMain('/focus') } },
      { type: 'separator' }
    )
  }
  items.push(
    { label: '＋  Hızlı görev ekle', accelerator: label, click: () => toggleQuickAdd() },
    { label: `☀  Bugün (${todays.length} açık görev)`, click: () => showMain('/today') },
    { label: '📅  Planlayıcı', click: () => showMain('/planner') },
    { label: now.getHours() < 15 ? '🌅  Günü planla' : '🌙  Günü kapat', click: () => showMain(now.getHours() < 15 ? '/morning' : '/shutdown') },
    { type: 'separator' },
    { label: 'Control Center’ı aç', click: () => showMain() },
    { label: '🔒  Kilitle', click: () => import('./session').then((m) => m.signOut()) },
    { label: 'Çıkış', click: () => { quitting = true; app.quit() } }
  )
  return Menu.buildFromTemplate(items)
}

export function refreshTray(): void {
  if (!tray || tray.isDestroyed()) return
  if (!isLoggedIn()) {
    tray.setToolTip('Control Center · kilitli')
    return
  }
  const session = activeSession()
  const task = session ? getTask(session.taskId) : null
  if (session && task) {
    const elapsed = (Date.now() - Date.parse(session.startedAt)) / 1000 + task.actualMin * 60
    tray.setToolTip(`🟢 ${task.title} · ${clock(elapsed)}`)
  } else {
    const open = listTasks({ view: 'today' }).filter((t) => t.status === 'planned' || t.status === 'active').length
    tray.setToolTip(`Control Center · bugün ${open} açık görev`)
  }
}

export function createTray(): void {
  const image = nativeImage.createFromPath(ICON()).resize({ width: 16, height: 16, quality: 'best' })
  tray = new Tray(image)
  tray.on('click', () => {
    const win = mainWindow()
    if (win?.isVisible() && win.isFocused()) win.hide()
    else showMain()
  })
  // Menü her açılışta güncel durumdan kurulur (açıkken yenilenip kapanmasın diye setContextMenu kullanılmaz)
  tray.on('right-click', () => tray?.popUpContextMenu(buildMenu()))
  refreshTray()
  // Sayaç ipucunda canlı görünsün
  setInterval(refreshTray, 5_000)
}
