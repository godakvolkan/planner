import type { TaskInput } from './types'

/** E-posta bağlantısı: IMAP + uygulama şifresi. Saf yardımcılar (testli). */

export type MailProvider = 'gmail' | 'outlook' | 'yandex' | 'icloud' | 'custom'
export type MailRule = 'flagged' | 'unread' | 'all'

export interface MailPreset {
  id: MailProvider
  label: string
  host: string
  port: number
  /** Uygulama şifresinin oluşturulduğu sayfa */
  appPasswordUrl: string | null
  /** Kullanıcıya adım adım ne yapacağı */
  steps: string[]
  /** Bilinen kısıt */
  warning?: string
}

export const MAIL_PRESETS: MailPreset[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    host: 'imap.gmail.com',
    port: 993,
    appPasswordUrl: 'https://myaccount.google.com/apppasswords',
    steps: [
      'Google Hesabı → Güvenlik → 2 Adımlı Doğrulama açık olmalı.',
      'Uygulama şifreleri sayfasında “Control Center” adıyla bir şifre oluştur.',
      'Gösterilen 16 harfli şifreyi buraya yapıştır (boşluklar önemli değil).'
    ]
  },
  {
    id: 'outlook',
    label: 'Outlook / Hotmail',
    host: 'outlook.office365.com',
    port: 993,
    appPasswordUrl: 'https://account.live.com/proofs/AppPassword',
    steps: ['Microsoft hesabında iki adımlı doğrulamayı aç.', 'Güvenlik → Gelişmiş güvenlik → Uygulama parolası oluştur.', 'Parolayı buraya yapıştır.'],
    warning: 'Microsoft, kişisel Outlook.com hesaplarında uygulama parolasıyla IMAP girişini kısıtlıyor; bağlantı reddedilebilir. Okul / iş hesaplarında yöneticinin IMAP’e izin vermesi gerekir.'
  },
  {
    id: 'yandex',
    label: 'Yandex',
    host: 'imap.yandex.com',
    port: 993,
    appPasswordUrl: 'https://id.yandex.com/security/app-passwords',
    steps: ['Yandex ID → Güvenlik → Uygulama şifreleri → “E-posta” türünde şifre oluştur.', 'Yandex Posta ayarlarında IMAP erişimi açık olmalı.', 'Şifreyi buraya yapıştır.']
  },
  {
    id: 'icloud',
    label: 'iCloud',
    host: 'imap.mail.me.com',
    port: 993,
    appPasswordUrl: 'https://account.apple.com/account/manage',
    steps: ['Apple Hesabı → Giriş ve Güvenlik → Uygulamaya özel parolalar.', 'Yeni parola oluştur ve buraya yapıştır.']
  },
  {
    id: 'custom',
    label: 'Diğer (IMAP)',
    host: '',
    port: 993,
    appPasswordUrl: null,
    steps: ['E-posta sağlayıcının IMAP sunucusunu ve (varsa) uygulama şifresini kullan. Bağlantı SSL/TLS (993) ile kurulur.']
  }
]

export const presetOf = (id: MailProvider): MailPreset => MAIL_PRESETS.find((p) => p.id === id) ?? MAIL_PRESETS[MAIL_PRESETS.length - 1]

export const RULE_LABEL: Record<MailRule, { label: string; hint: string }> = {
  flagged: { label: 'Yıldızlılar', hint: 'Sadece yıldızladığın e-postalar görev olur (önerilen)' },
  unread: { label: 'Okunmamışlar', hint: 'Yeni gelen okunmamış e-postalar' },
  all: { label: 'Tümü', hint: 'Gelen kutusuna düşen her e-posta' }
}

/** Adresin alan adından sağlayıcıyı tahmin et */
export function detectProvider(email: string): MailProvider {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  if (/^(gmail|googlemail)\.com$/.test(domain)) return 'gmail'
  if (/^(outlook|hotmail|live|msn)\.[a-z.]+$/.test(domain)) return 'outlook'
  if (/^yandex\.[a-z.]+$/.test(domain) || domain === 'ya.ru') return 'yandex'
  if (/^(icloud|me|mac)\.com$/.test(domain)) return 'icloud'
  return 'custom'
}

/** Gmail’de bu e-postayı açan bağlantı (Message-ID ile arama) */
export const gmailLink = (messageId: string): string => `https://mail.google.com/mail/u/0/#search/rfc822msgid%3A${encodeURIComponent(messageId.replace(/^<|>$/g, ''))}`

export interface MailEnvelope {
  uid: number
  messageId: string | null
  subject: string | null
  fromName: string | null
  fromAddress: string | null
  /** ISO */
  date: string | null
}

/** Tekrar aktarımı önleyen anahtar */
export const messageKey = (env: MailEnvelope, uidValidity: string): string => env.messageId?.trim() || `uid:${uidValidity}:${env.uid}`

/** E-postadan Inbox görevi */
export function taskFromMail(env: MailEnvelope, provider: MailProvider, areaId: number | null): TaskInput {
  const subject = (env.subject ?? '').replace(/\s+/g, ' ').trim()
  const from = env.fromName && env.fromAddress ? `${env.fromName} <${env.fromAddress}>` : (env.fromAddress ?? env.fromName ?? 'bilinmiyor')
  const date = env.date ? new Date(env.date).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null
  const link = provider === 'gmail' && env.messageId ? gmailLink(env.messageId) : null
  return {
    title: (subject || `${env.fromName ?? env.fromAddress ?? 'Bilinmeyen'} adlı kişiden e-posta`).slice(0, 200),
    notes: [`📧 Kimden: ${from}`, date && `Tarih: ${date}`].filter(Boolean).join('\n'),
    status: 'inbox',
    areaId,
    firstStep: 'E-postayı aç',
    firstStepType: link ? 'url' : null,
    firstStepTarget: link
  }
}

/** Bu kurala göre IMAP aramasının başlangıç tarihi: ilk eşitlemede son 7 gün, sonra son eşitlemeden 1 gün önce */
export function searchSince(rule: MailRule, lastSyncedAt: string | null, now: Date = new Date()): Date {
  const day = 86_400_000
  if (!lastSyncedAt) return new Date(now.getTime() - 7 * day)
  // Yıldız sonradan da eklenebilir: yıldızlılarda son 30 güne bak
  if (rule === 'flagged') return new Date(now.getTime() - 30 * day)
  return new Date(Math.max(new Date(lastSyncedAt).getTime() - day, now.getTime() - 30 * day))
}
