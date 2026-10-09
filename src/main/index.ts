import { app, BrowserWindow, globalShortcut, shell } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc'
import { TITLE_BAR, resourcePath } from './window'
import { getSettings } from './repos/settings'
import { createTray, isQuitting, markQuitting, showMain } from './desktop'
import { isLoggedIn } from './auth'
import { signOut } from './session'

/** Giriş yapılmamışken (profil ayarı okunamaz) varsayılan: kapatınca tepsiye küçül */
const closeToTray = (): boolean => (isLoggedIn() ? getSettings().closeToTray : true)

// Tek örnek: ikinci kez açılırsa var olan pencereye odaklan
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showMain())

  app.whenReady().then(() => {
    // Windows'ta bildirimlerin görünmesi için uygulama kimliği gerekir
    if (process.platform === 'win32') app.setAppUserModelId(app.isPackaged ? 'com.controlcenter.app' : process.execPath)
    registerIpc()
    createWindow()
    createTray()
    // Veriye bağlı servisler (bildirim, yedek, kısayol, tekrar görevleri) giriş yapılınca başlar: session.ts
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
      else showMain()
    })
  })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    // Dar pencerede kenar çubuğu çekmeceye döner (renderer lib/layout.ts); ekranın yarısına / çeyreğine yaslanabilir
    minWidth: 400,
    minHeight: 480,
    titleBarStyle: 'hidden',
    titleBarOverlay: TITLE_BAR.dark,
    backgroundColor: '#14182b',
    show: false,
    icon: resourcePath('icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Tepsideyken de Pomodoro / odak sayaçları zamanında bitsin
      backgroundThrottling: false
    }
  })

  // Bağlantılar (ör. "uygulama şifresi sayfasını aç") uygulama içinde değil sistem tarayıcısında açılır
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (['https:', 'http:', 'mailto:'].includes(new URL(url).protocol)) void shell.openExternal(url)
    } catch {
      // geçersiz adres: açılmaz
    }
    return { action: 'deny' }
  })
  // Pencerenin kendisi başka bir sayfaya yönlendirilemesin
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:') && !(process.env.ELECTRON_RENDERER_URL && url.startsWith(process.env.ELECTRON_RENDERER_URL))) e.preventDefault()
  })

  // Uygulama "--hidden" ile (Windows açılışında) başlarsa pencere açılmadan tepside bekler
  mainWindow.once('ready-to-show', () => {
    if (!process.argv.includes('--hidden')) mainWindow.show()
  })

  // Kapat düğmesi: ayara göre tepsiye küçül; bildirimler ve kısayol çalışmaya devam eder
  mainWindow.on('close', (e) => {
    if (!isQuitting() && closeToTray()) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.on('before-quit', () => {
  markQuitting()
  // Çalışan odak oturumu kaydedilsin, veritabanı düzgün kapansın
  if (isLoggedIn()) signOut()
})
app.on('will-quit', () => globalShortcut.unregisterAll())

// Tepsi açıkken pencereler kapansa da uygulama çalışmaya devam eder; çıkış tepsi menüsünden
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !closeToTray()) app.quit()
})
