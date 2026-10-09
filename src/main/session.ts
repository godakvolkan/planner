import { BrowserWindow, globalShortcut } from 'electron'
import { currentProfileInfo, login, loginWithIdentifier, loginWithVerifiedEmail, logout, type LoginResult } from './auth'
import { googleSignIn } from './google'
import { startMailSync } from './mail'
import { startScheduler } from './scheduler'
import { startNotifier } from './notifier'
import { startAutoBackup } from './repos/data'
import { stopSession } from './repos/sessions'
import { broadcastChange, hideQuickAdd, refreshTray, registerShortcuts, showMain } from './desktop'

/**
 * Oturum yaşam döngüsü: profil verisine bağlı tüm servisler (tekrar zamanlayıcısı, bildirimler,
 * otomatik yedek, global kısayollar) sadece giriş yapılmışken çalışır.
 */

let stops: (() => void)[] = []

export function broadcastAuth(): void {
  const profile = currentProfileInfo()
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('auth:changed', profile)
}

export const signIn = (id: string, password: string): LoginResult => start(login(id, password))

/** E-posta (ya da eski profillerde ad) + şifre */
export const signInWithEmail = (identifier: string, password: string): LoginResult => start(loginWithIdentifier(identifier, password))

/** Google ile giriş. Profil yoksa e-posta ve adı döner; giriş ekranı bu bilgilerle profil oluşturmayı önerir. */
export async function signInWithGoogle(): Promise<LoginResult & { google?: { email: string; name: string | null } }> {
  const identity = await googleSignIn()
  const result = start(loginWithVerifiedEmail(identity.email))
  // Tarayıcıdan dönünce uygulama öne gelsin
  showMain()
  return result.ok ? result : { ...result, google: identity }
}

function start(result: LoginResult): LoginResult {
  if (!result.ok) return result
  stopServices()
  stops = [startNotifier(), startAutoBackup(), startScheduler(broadcastChange), startMailSync(broadcastChange)]
  registerShortcuts()
  refreshTray()
  broadcastAuth()
  return result
}

function stopServices(): void {
  for (const stop of stops) {
    try {
      stop()
    } catch {
      // bir servis durdurulamazsa diğerleri yine durdurulsun
    }
  }
  stops = []
}

/** Kilitle / çıkış: çalışan odak oturumu kaydedilir, servisler durur, veritabanı kapanır */
export function signOut(): void {
  try {
    stopSession()
  } catch {
    // oturum açık değilse sorun yok
  }
  stopServices()
  globalShortcut.unregisterAll()
  hideQuickAdd()
  logout()
  refreshTray()
  broadcastAuth()
}
