import { db } from '../db'
import { google } from 'googleapis'
import { shell } from 'electron'
import http from 'http'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'
const CLIENT_SECRET = 'YOUR_GOOGLE_CLIENT_SECRET'
const REDIRECT_URI = 'http://127.0.0.1:3456/oauth2callback'

// To actually get this to work without user supplying their own client ID,
// the developer (Volkan) needs to set up a Google Cloud Project, enable Drive API,
// set OAuth consent screen to Desktop app, and insert credentials here.

let oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

export interface DriveStatus {
  connected: boolean
  email?: string
  lastBackupAt?: string
}

export function getDriveStatus(): DriveStatus {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('drive_token') as { value: string } | undefined
  let connected = false
  let email: string | undefined
  
  if (row?.value) {
    try {
      const tokens = JSON.parse(row.value)
      if (tokens.access_token) {
        connected = true
        email = tokens.email // We save email when connecting
      }
    } catch {}
  }
  
  const bRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('drive_last_backup') as { value: string } | undefined
  return {
    connected,
    email,
    lastBackupAt: bRow ? JSON.parse(bRow.value) : undefined
  }
}

export async function connectDrive(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email'],
      prompt: 'consent'
    })

    const server = http.createServer(async (req, res) => {
      try {
        if (req.url && req.url.startsWith('/oauth2callback')) {
          const url = new URL(req.url, 'http://127.0.0.1:3456')
          const code = url.searchParams.get('code')
          
          if (code) {
            const { tokens } = await oauth2Client.getToken(code)
            oauth2Client.setCredentials(tokens)
            
            // Get user email
            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
            const userInfo = await oauth2.userinfo.get()
            const email = userInfo.data.email
            
            const toSave = { ...tokens, email }
            db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('drive_token', JSON.stringify(toSave))
            
            res.end('<h1>Basariyla giris yapildi!</h1><p>Bu pencereyi kapatabilirsiniz.</p>')
            server.close()
            resolve(true)
          } else {
            res.end('<h1>Hata!</h1><p>Yetkilendirme basarisiz.</p>')
            server.close()
            resolve(false)
          }
        }
      } catch (err) {
        console.error(err)
        res.end('<h1>Hata!</h1><p>Sunucu hatasi.</p>')
        server.close()
        reject(err)
      }
    })

    server.listen(3456, () => {
      shell.openExternal(authUrl)
    })
  })
}

export async function disconnectDrive(): Promise<void> {
  db.prepare('DELETE FROM settings WHERE key = ?').run('drive_token')
  oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
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
  if (!status.connected) throw new Error('Google Drive bagli degil')
    
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('drive_token') as { value: string }
  const tokens = JSON.parse(row.value)
  oauth2Client.setCredentials(tokens)

  const drive = google.drive({ version: 'v3', auth: oauth2Client })

  // Prepare backup file locally
  const tempPath = path.join(app.getPath('temp'), `planner_backup_${Date.now()}.enc`)
  
  // Dump everything (simplistic export)
  const tasks = db.prepare('SELECT * FROM tasks').all()
  const events = db.prepare('SELECT * FROM events').all()
  const areas = db.prepare('SELECT * FROM areas').all()
  
  const rawData = JSON.stringify({ tasks, events, areas })
  
  // Encrypt
  const iv = crypto.randomBytes(16)
  const key = getEncryptionKey()
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  
  const encrypted = Buffer.concat([cipher.update(rawData, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  
  const finalBuffer = Buffer.concat([iv, authTag, encrypted])
  fs.writeFileSync(tempPath, finalBuffer)

  try {
    // Check if backup folder exists
    let folderId: string | undefined
    const q = await drive.files.list({ q: "mimeType='application/vnd.google-apps.folder' and name='Planner Backups' and trashed=false", spaces: 'drive' })
    if (q.data.files && q.data.files.length > 0) {
      folderId = q.data.files[0].id!
    } else {
      const folder = await drive.files.create({
        requestBody: { name: 'Planner Backups', mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id'
      })
      folderId = folder.data.id!
    }

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `backup-${dateStr}.enc`

    await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId]
      },
      media: {
        mimeType: 'application/octet-stream',
        body: fs.createReadStream(tempPath)
      }
    })
    
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('drive_last_backup', JSON.stringify(new Date().toISOString()))
    return true
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
  }
}
