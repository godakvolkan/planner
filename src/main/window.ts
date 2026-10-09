import { app, BrowserWindow } from 'electron'
import { join, sep } from 'path'

/** resources/ altındaki bir dosyanın gerçek yolu (paketli sürümde app.asar.unpacked içindedir) */
export function resourcePath(name: string): string {
  return join(app.getAppPath(), 'resources', name).replace(`app.asar${sep}`, `app.asar.unpacked${sep}`)
}

/** Pencere düğmeleri (Windows) için renkler; renderer'daki --sidebar / --background tonlarıyla uyumlu */
export const TITLE_BAR = {
  dark: { color: '#14182b', symbolColor: '#a7aed0', height: 40 },
  light: { color: '#f1f3fa', symbolColor: '#4b5170', height: 40 }
}

export function setTitleBar(dark: boolean): void {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.setTitleBarOverlay(dark ? TITLE_BAR.dark : TITLE_BAR.light)
    } catch {
      // titleBarOverlay olmayan pencerelerde (macOS vb.) desteklenmez
    }
  }
}
