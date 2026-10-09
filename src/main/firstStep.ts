import { BrowserWindow, dialog, shell } from 'electron'
import { existsSync, statSync } from 'fs'
import { extname } from 'path'
import { getTask } from './repos/tasks'

/** Çalıştırılabilir dosyalar güvenlik için açılmaz */
const BLOCKED = new Set(['.exe', '.bat', '.cmd', '.com', '.ps1', '.psm1', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.msi', '.msp', '.scr', '.lnk', '.reg', '.hta', '.cpl', '.jar'])
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export async function openFirstStep(taskId: number): Promise<{ ok: boolean; error?: string }> {
  const task = getTask(taskId)
  if (!task?.firstStepTarget || !task.firstStepType) return { ok: false, error: 'Bu görevin açılacak bir ilk adımı yok.' }
  const target = task.firstStepTarget

  if (task.firstStepType === 'url') {
    let url: URL
    try {
      url = new URL(target)
    } catch {
      return { ok: false, error: 'Bağlantı geçersiz.' }
    }
    if (!SAFE_PROTOCOLS.has(url.protocol)) return { ok: false, error: 'Sadece http, https ve mailto bağlantıları açılır.' }
    await shell.openExternal(url.toString())
    return { ok: true }
  }

  if (!existsSync(target)) return { ok: false, error: task.firstStepType === 'folder' ? 'Klasör bulunamadı.' : 'Dosya bulunamadı.' }
  const isDir = statSync(target).isDirectory()
  if (!isDir && BLOCKED.has(extname(target).toLowerCase())) {
    return { ok: false, error: 'Güvenlik için program dosyaları açılmaz.' }
  }
  const error = await shell.openPath(target)
  return error ? { ok: false, error: 'Açılamadı: ' + error } : { ok: true }
}

export async function pickPath(kind: 'file' | 'folder'): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const options: Electron.OpenDialogOptions = {
    title: kind === 'file' ? 'İlk adımda açılacak dosya' : 'İlk adımda açılacak klasör',
    properties: [kind === 'file' ? 'openFile' : 'openDirectory']
  }
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  return result.canceled || !result.filePaths[0] ? null : result.filePaths[0]
}
