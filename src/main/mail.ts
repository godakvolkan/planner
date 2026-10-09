import { safeStorage } from 'electron'
import { ImapFlow } from 'imapflow'
import { db } from './db'
import { currentProfileId } from './auth'
import { createTask } from './repos/tasks'
import { detectProvider, messageKey, presetOf, searchSince, taskFromMail, type MailEnvelope, type MailProvider, type MailRule } from '../shared/mail'
import type { MailAccount, MailAccountInput, MailAccountPatch } from '../shared/types'

/**
 * E-posta → Inbox. IMAP + uygulama şifresi; her profil kendi hesaplarını bağlar (veri profilin veritabanında).
 * Şifre safeStorage ile (Windows DPAPI) şifrelenir ve arayüze asla geri gönderilmez.
 */

const SYNC_EVERY_MS = 10 * 60 * 1000
const MAX_PER_SYNC = 50
const RULES: MailRule[] = ['flagged', 'unread', 'all']

interface AccountRow {
  id: number
  provider: MailProvider
  email: string
  host: string
  port: number
  secret: Buffer
  mailbox: string
  rule: MailRule
  area_id: number | null
  enabled: number
  last_synced_at: string | null
  last_error: string | null
  created_at: string
  imported?: number
}

const toAccount = (r: AccountRow): MailAccount => ({
  id: r.id,
  provider: r.provider,
  email: r.email,
  host: r.host,
  port: r.port,
  rule: r.rule,
  areaId: r.area_id,
  enabled: r.enabled === 1,
  lastSyncedAt: r.last_synced_at,
  lastError: r.last_error,
  imported: r.imported ?? 0
})

const SELECT = `SELECT a.*, (SELECT COUNT(*) FROM mail_imports i WHERE i.account_id = a.id) AS imported FROM mail_accounts a`

export function listMailAccounts(): MailAccount[] {
  return (db.prepare(`${SELECT} ORDER BY a.id`).all() as AccountRow[]).map(toAccount)
}

function mustGet(id: number): AccountRow {
  const row = db.prepare(`${SELECT} WHERE a.id = ?`).get(id) as AccountRow | undefined
  if (!row) throw new Error('E-posta hesabı bulunamadı')
  return row
}

function encrypt(password: string): Buffer {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Bu bilgisayarda güvenli şifre saklama kullanılamıyor; hesap kaydedilmedi.')
  return safeStorage.encryptString(password)
}

const decrypt = (secret: Buffer): string => safeStorage.decryptString(Buffer.from(secret))

/** IMAP hatasını kullanıcının anlayacağı dile çevir */
function friendly(e: unknown, provider: MailProvider): string {
  const err = e as { authenticationFailed?: boolean; code?: string; message?: string; responseText?: string }
  if (err?.authenticationFailed) {
    return provider === 'outlook'
      ? 'Giriş reddedildi. Microsoft kişisel hesaplarda uygulama parolasıyla IMAP’i kısıtlıyor olabilir; parolayı da kontrol et.'
      : 'Giriş reddedildi: e-posta ya da uygulama şifresi yanlış. Normal hesap şifren çalışmaz; uygulama şifresi oluşturman gerekir.'
  }
  if (err?.code === 'ENOTFOUND' || err?.code === 'EAI_AGAIN') return 'Sunucu bulunamadı. İnternet bağlantını ve sunucu adresini kontrol et.'
  if (err?.code === 'ECONNREFUSED') return 'Sunucu bağlantıyı reddetti (port ya da IMAP erişimi kapalı olabilir).'
  if (err?.code === 'ETIMEDOUT' || /timeout/i.test(err?.message ?? '')) return 'Sunucu yanıt vermedi (zaman aşımı).'
  if (/certificate|self.signed/i.test(err?.message ?? '')) return 'Sunucunun güvenlik sertifikası doğrulanamadı.'
  return `Bağlanılamadı: ${(err?.responseText || err?.message || 'bilinmeyen hata').slice(0, 160)}`
}

function client(host: string, port: number, user: string, pass: string): ImapFlow {
  return new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass: pass.replace(/\s+/g, '') },
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
    clientInfo: { name: 'Control Center' }
  })
}

/** Bağlantıyı dener (kaydetmeden önce) */
async function testLogin(host: string, port: number, user: string, pass: string, provider: MailProvider): Promise<void> {
  const c = client(host, port, user, pass)
  c.on('error', () => undefined)
  try {
    await c.connect()
    await c.mailboxOpen('INBOX', { readOnly: true })
  } catch (e) {
    throw new Error(friendly(e, provider))
  } finally {
    await c.logout().catch(() => c.close())
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Hesap ekler (önce bağlantı denenir). Aynı adres varsa şifresi ve ayarları güncellenir. */
export async function addMailAccount(input: MailAccountInput): Promise<MailAccount> {
  const email = String(input?.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) throw new Error('Geçerli bir e-posta adresi yaz')
  const password = String(input.password ?? '')
  if (password.replace(/\s+/g, '').length < 4) throw new Error('Uygulama şifresini yapıştır')
  const provider: MailProvider = input.provider ?? detectProvider(email)
  const preset = presetOf(provider)
  const host = (provider === 'custom' ? String(input.host ?? '') : preset.host).trim().toLowerCase()
  // Alan adı, localhost ya da IPv4 (kendi sunucusunu kullananlar için)
  if (!/^(([a-z0-9-]+\.)+[a-z]{2,}|localhost|\d{1,3}(\.\d{1,3}){3})$/.test(host)) throw new Error('IMAP sunucusunu yaz (örn. imap.ornek.com)')
  const port = provider === 'custom' ? Number(input.port) || 993 : preset.port
  if (port < 1 || port > 65535) throw new Error('Port geçersiz')
  const rule: MailRule = RULES.includes(input.rule as MailRule) ? (input.rule as MailRule) : 'flagged'

  await testLogin(host, port, email, password, provider)
  const secret = encrypt(password)
  db.prepare(
    `INSERT INTO mail_accounts (provider, email, host, port, secret, rule, area_id) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET provider = excluded.provider, host = excluded.host, port = excluded.port, secret = excluded.secret,
       rule = excluded.rule, area_id = excluded.area_id, enabled = 1, last_error = NULL`
  ).run(provider, email, host, port, secret, rule, input.areaId ?? null)
  const id = (db.prepare('SELECT id FROM mail_accounts WHERE email = ?').get(email) as { id: number }).id
  return toAccount(mustGet(id))
}

export function updateMailAccount(id: number, patch: MailAccountPatch): MailAccount {
  mustGet(id)
  if (patch.rule !== undefined) {
    if (!RULES.includes(patch.rule)) throw new Error('Geçersiz kural')
    db.prepare('UPDATE mail_accounts SET rule = ? WHERE id = ?').run(patch.rule, id)
  }
  if (patch.areaId !== undefined) db.prepare('UPDATE mail_accounts SET area_id = ? WHERE id = ?').run(patch.areaId, id)
  if (patch.enabled !== undefined) db.prepare('UPDATE mail_accounts SET enabled = ? WHERE id = ?').run(patch.enabled ? 1 : 0, id)
  return toAccount(mustGet(id))
}

/** Hesabı kaldırır; oluşturulmuş görevler durur */
export function removeMailAccount(id: number): void {
  db.prepare('DELETE FROM mail_accounts WHERE id = ?').run(id)
}

/** Sunucudan kurala uyan e-postaların zarflarını getirir (yalnızca okur; e-postaya dokunmaz) */
async function fetchEnvelopes(row: AccountRow): Promise<{ envelopes: MailEnvelope[]; uidValidity: string }> {
  const c = client(row.host, row.port, row.email, decrypt(row.secret))
  c.on('error', () => undefined)
  await c.connect()
  try {
    const lock = await c.getMailboxLock(row.mailbox, { readOnly: true })
    try {
      const uidValidity = c.mailbox ? String(c.mailbox.uidValidity) : '0'
      const since = searchSince(row.rule, row.last_synced_at, row.created_at)
      const query = { since, ...(row.rule === 'flagged' ? { flagged: true } : row.rule === 'unread' ? { seen: false } : {}) }
      const found = await c.search(query, { uid: true })
      const uids = (found || []).sort((a, b) => a - b).slice(-MAX_PER_SYNC)
      const envelopes: MailEnvelope[] = []
      if (uids.length) {
        for await (const m of c.fetch(uids, { uid: true, envelope: true }, { uid: true })) {
          const from = m.envelope?.from?.[0]
          envelopes.push({
            uid: m.uid,
            messageId: m.envelope?.messageId ?? null,
            subject: m.envelope?.subject ?? null,
            fromName: from?.name || null,
            fromAddress: from?.address || null,
            date: m.envelope?.date ? new Date(m.envelope.date).toISOString() : null
          })
        }
      }
      return { envelopes, uidValidity }
    } finally {
      lock.release()
    }
  } finally {
    await c.logout().catch(() => c.close())
  }
}

/** Yeni e-postaları görev yapar; tekrar eklemez. Dönen değer: eklenen görev sayısı */
const importTx = db.transaction((row: AccountRow, envelopes: MailEnvelope[], uidValidity: string): number => {
  let added = 0
  const exists = db.prepare('SELECT 1 FROM mail_imports WHERE account_id = ? AND message_key = ?')
  const log = db.prepare('INSERT INTO mail_imports (account_id, message_key, task_id, imported_at) VALUES (?, ?, ?, ?)')
  for (const env of envelopes) {
    const key = messageKey(env, uidValidity)
    if (exists.get(row.id, key)) continue
    const task = createTask(taskFromMail(env, row.provider, row.area_id))
    log.run(row.id, key, task.id, new Date().toISOString())
    added++
  }
  db.prepare('UPDATE mail_accounts SET last_synced_at = ?, last_error = NULL WHERE id = ?').run(new Date().toISOString(), row.id)
  return added
})

let syncing: Promise<{ added: number; errors: string[] }> | null = null

/** Bir hesabı ya da (id yoksa) tüm açık hesapları eşitler. Aynı anda tek eşitleme. */
export function syncMail(id?: number): Promise<{ added: number; errors: string[] }> {
  if (syncing) return syncing
  syncing = (async () => {
    // Ağ beklenirken profil değişirse başka profilin veritabanına yazılmasın
    const profile = currentProfileId()
    const rows = id ? [mustGet(id)] : (db.prepare(`${SELECT} WHERE a.enabled = 1`).all() as AccountRow[])
    let added = 0
    const errors: string[] = []
    for (const row of rows) {
      try {
        const { envelopes, uidValidity } = await fetchEnvelopes(row)
        if (currentProfileId() !== profile) break
        added += importTx(row, envelopes, uidValidity)
      } catch (e) {
        const msg = friendly(e, row.provider)
        errors.push(`${row.email}: ${msg}`)
        try {
          if (currentProfileId() === profile) db.prepare('UPDATE mail_accounts SET last_error = ? WHERE id = ?').run(msg, row.id)
        } catch {
          // oturum bu arada kapandıysa yazılamaz
        }
      }
    }
    return { added, errors }
  })().finally(() => {
    syncing = null
  })
  return syncing
}

/** Oturum açıkken arka planda periyodik eşitleme (session.ts başlatır / durdurur) */
export function startMailSync(onChange: () => void): () => void {
  let stopped = false
  const tick = async (): Promise<void> => {
    if (stopped) return
    try {
      const hasAccounts = (db.prepare('SELECT COUNT(*) AS n FROM mail_accounts WHERE enabled = 1').get() as { n: number }).n > 0
      if (!hasAccounts) return
      const r = await syncMail()
      if (!stopped && (r.added || r.errors.length)) onChange()
    } catch {
      // oturum kapandıysa ya da ağ yoksa bir sonraki turda tekrar denenir
    }
  }
  const first = setTimeout(tick, 15_000)
  const timer = setInterval(tick, SYNC_EVERY_MS)
  return () => {
    stopped = true
    clearTimeout(first)
    clearInterval(timer)
  }
}
