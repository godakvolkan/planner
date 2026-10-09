import { BrowserWindow, dialog, shell } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import Database from 'better-sqlite3'
import { db } from '../db'
import { currentProfileId, profileDir } from '../auth'
import { today } from '../../shared/dates'
import type { BackupInfo } from '../../shared/types'

/** Yedek / içe aktarma kapsamındaki tablolar (sıra: önce bağımsız tablolar) */
const TABLES = [
  'areas', 'tags', 'recurrences', 'tasks', 'task_tags', 'sessions', 'time_blocks', 'postpone_log',
  'recurrence_log', 'fixed_events', 'day_capacity', 'capacity_overrides', 'daily_rituals', 'settings'
]
const KEEP_BACKUPS = 7

export const backupDir = (): string => {
  const id = currentProfileId()
  if (!id) throw new Error('Giriş yapılmadı')
  return join(profileDir(id), 'backups')
}

function parentWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

function schemaVersion(): number {
  return (db.prepare('SELECT MAX(version) AS v FROM schema_version').get() as { v: number }).v
}

// ---------------------------------------------------------------- dışa aktarma

export async function exportJson(): Promise<string | null> {
  const win = parentWindow()
  const options = { title: 'Verileri dışa aktar', defaultPath: `control-center-${today()}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] }
  const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  const data = Object.fromEntries(TABLES.map((t) => [t, db.prepare(`SELECT * FROM ${t}`).all()]))
  const payload = { app: 'control-center', schemaVersion: schemaVersion(), exportedAt: new Date().toISOString(), data }
  writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf8')
  return result.filePath
}

// ---------------------------------------------------------------- içe aktarma

type Rows = Record<string, Record<string, unknown>[]>

/** Tüm tabloları verilen satırlarla değiştirir. Sadece hedef tabloda var olan sütunlar yazılır. */
const replaceAllTx = db.transaction((data: Rows): number => {
  db.pragma('foreign_keys = OFF')
  try {
    for (const t of [...TABLES].reverse()) db.prepare(`DELETE FROM ${t}`).run()
    for (const t of TABLES) {
      const rows = data[t]
      if (!Array.isArray(rows) || !rows.length) continue
      const cols = new Set((db.prepare(`SELECT name FROM pragma_table_info(?)`).all(t) as { name: string }[]).map((c) => c.name))
      for (const row of rows) {
        const keys = Object.keys(row).filter((k) => cols.has(k))
        if (!keys.length) continue
        db.prepare(`INSERT OR REPLACE INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(
          ...keys.map((k) => row[k] as never)
        )
      }
    }
    return (db.prepare('SELECT COUNT(*) AS n FROM tasks').get() as { n: number }).n
  } finally {
    db.pragma('foreign_keys = ON')
  }
})

function validatePayload(raw: unknown): Rows {
  const p = raw as { app?: string; schemaVersion?: number; data?: Rows }
  if (!p || p.app !== 'control-center' || typeof p.data !== 'object') throw new Error('Bu dosya bir Control Center yedeği değil.')
  if (typeof p.schemaVersion === 'number' && p.schemaVersion > schemaVersion()) {
    throw new Error('Bu yedek uygulamanın daha yeni bir sürümünden. Önce uygulamayı güncelle.')
  }
  if (!Array.isArray(p.data.tasks) || !Array.isArray(p.data.areas)) throw new Error('Yedek dosyası eksik veya bozuk.')
  return p.data
}

export async function importJson(): Promise<{ tasks: number } | null> {
  const win = parentWindow()
  const options: Electron.OpenDialogOptions = { title: 'Yedekten içe aktar', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] }
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  if (result.canceled || !result.filePaths[0]) return null
  let data: Rows
  try {
    data = validatePayload(JSON.parse(readFileSync(result.filePaths[0], 'utf8')))
  } catch (err) {
    throw new Error(err instanceof SyntaxError ? 'Dosya okunamadı: geçerli bir JSON değil.' : (err as Error).message)
  }
  await backupNow('ice-aktarma-oncesi')
  return { tasks: replaceAllTx(data) }
}

// ---------------------------------------------------------------- otomatik yedek

function listFiles(): BackupInfo[] {
  const dir = backupDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((name) => {
      const path = join(dir, name)
      const st = statSync(path)
      return { path, name, createdAt: st.mtime.toISOString(), sizeBytes: st.size }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function listBackups(): BackupInfo[] {
  return listFiles()
}

/** SQLite çevrimiçi yedek API'si: uygulama açıkken güvenli */
export async function backupNow(tag = ''): Promise<BackupInfo> {
  const dir = backupDir()
  mkdirSync(dir, { recursive: true })
  const d = new Date()
  const p2 = (n: number): string => String(n).padStart(2, '0')
  // Yerel saat (dosya adında UTC görünmesin)
  const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}-${p2(d.getMinutes())}-${p2(d.getSeconds())}`
  const path = join(dir, `control_center-${stamp}${tag ? '-' + tag : ''}.db`)
  await db.backup(path)
  const size = statSync(path).size
  db.prepare('INSERT INTO backups (created_at, path, size_bytes) VALUES (?, ?, ?)').run(new Date().toISOString(), path, size)
  // Otomatik yedeklerden sadece son 7'si tutulur (elle/özel etiketli olanlar da sayılır)
  for (const old of listFiles().slice(KEEP_BACKUPS)) {
    try {
      unlinkSync(old.path)
    } catch {
      // kilitli dosya: bir sonraki sefere
    }
  }
  return { path, name: basename(path), createdAt: new Date().toISOString(), sizeBytes: size }
}

/** Son yedek 24 saatten eskiyse yeni yedek alır */
export async function autoBackup(): Promise<void> {
  const last = listFiles()[0]
  if (last && Date.now() - Date.parse(last.createdAt) < 24 * 3600 * 1000) return
  await backupNow()
}

export function startAutoBackup(): () => void {
  const run = (): void => {
    autoBackup().catch((err) => console.error('Otomatik yedek alınamadı', err))
  }
  const first = setTimeout(run, 15_000) // açılışı yavaşlatmasın
  const timer = setInterval(run, 6 * 3600 * 1000)
  return () => {
    clearTimeout(first)
    clearInterval(timer)
  }
}

export async function openBackupFolder(): Promise<void> {
  mkdirSync(backupDir(), { recursive: true })
  await shell.openPath(backupDir())
}

export async function restoreBackup(path: string): Promise<void> {
  const dir = backupDir()
  if (!path.startsWith(dir) || !existsSync(path)) throw new Error('Yedek bulunamadı.')
  const src = new Database(path, { readonly: true, fileMustExist: true })
  let data: Rows
  try {
    const srcTables = new Set((src.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map((r) => r.name))
    data = Object.fromEntries(TABLES.filter((t) => srcTables.has(t)).map((t) => [t, src.prepare(`SELECT * FROM ${t}`).all() as Record<string, unknown>[]]))
  } finally {
    src.close()
  }
  await backupNow('geri-yukleme-oncesi')
  replaceAllTx(data)
}
