import { db } from '../db'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { dialog } from 'electron'

export interface DriveStatus {
  connected: boolean
  syncFolder?: string
  lastBackupAt?: string
}

export function getDriveStatus(): DriveStatus {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('sync_folder') as { value: string } | undefined
  const bRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('drive_last_backup') as { value: string } | undefined
  
  return {
    connected: !!row?.value,
    syncFolder: row?.value ? JSON.parse(row.value) : undefined,
    lastBackupAt: bRow ? JSON.parse(bRow.value) : undefined
  }
}

export async function connectDrive(): Promise<boolean> {
  const res = await dialog.showOpenDialog({
    title: 'Bulut Eşitleme Klasörünü Seçin (Google Drive, OneDrive vb.)',
    properties: ['openDirectory', 'createDirectory']
  })
  
  if (res.canceled || res.filePaths.length === 0) return false
  
  const folder = res.filePaths[0]
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('sync_folder', JSON.stringify(folder))
  return true
}

export async function disconnectDrive(): Promise<void> {
  db.prepare('DELETE FROM settings WHERE key = ?').run('sync_folder')
}

function getEncryptionKey(): Buffer {
  let row = db.prepare('SELECT value FROM settings WHERE key = ?').get('backup_key') as { value: string } | undefined
  if (!row) {
    const key = crypto.randomBytes(32).toString('hex')
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('backup_key', JSON.stringify(key))
    row = { value: JSON.stringify(key) }
  }
  return Buffer.from(JSON.parse(row.value), 'hex')
}

export async function backupToDrive(): Promise<boolean> {
  const status = getDriveStatus()
  if (!status.connected || !status.syncFolder) throw new Error('Eşitleme klasörü seçilmedi')
    
  if (!fs.existsSync(status.syncFolder)) {
    fs.mkdirSync(status.syncFolder, { recursive: true })
  }

  const tasks = db.prepare('SELECT * FROM tasks').all()
  const events = db.prepare('SELECT * FROM events').all()
  const areas = db.prepare('SELECT * FROM areas').all()
  
  const rawData = JSON.stringify({ tasks, events, areas })
  
  const iv = crypto.randomBytes(16)
  const key = getEncryptionKey()
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  
  const encrypted = Buffer.concat([cipher.update(rawData, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  const finalBuffer = Buffer.concat([iv, authTag, encrypted])
  
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `Planner-Backup-${dateStr}.enc`
  const destPath = path.join(status.syncFolder, fileName)

  fs.writeFileSync(destPath, finalBuffer)
  
  // Eski yedekleri temizle (Sadece en son 10 yedek kalsın)
  try {
    const files = fs.readdirSync(status.syncFolder)
      .filter(f => f.startsWith('Planner-Backup-') && f.endsWith('.enc'))
      .map(f => ({ name: f, path: path.join(status.syncFolder!, f), time: fs.statSync(path.join(status.syncFolder!, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time)
      
    if (files.length > 10) {
      for (let i = 10; i < files.length; i++) {
        fs.unlinkSync(files[i].path)
      }
    }
  } catch (e) {
    console.error('Eski yedekler temizlenirken hata', e)
  }

  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('drive_last_backup', JSON.stringify(new Date().toISOString()))
  return true
}
