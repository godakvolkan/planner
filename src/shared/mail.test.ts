import { describe, expect, it } from 'vitest'
import { detectProvider, gmailLink, messageKey, searchSince, taskFromMail, type MailEnvelope } from './mail'

const env: MailEnvelope = {
  uid: 42,
  messageId: '<CAB123@mail.gmail.com>',
  subject: '  TÜBİTAK   ara rapor  teslimi ',
  fromName: 'Danışman Hoca',
  fromAddress: 'hoca@uni.edu.tr',
  date: '2026-10-08T09:30:00.000Z'
}

describe('detectProvider', () => {
  it('alan adından sağlayıcı', () => {
    expect(detectProvider('ali@gmail.com')).toBe('gmail')
    expect(detectProvider('Ali@GoogleMail.com')).toBe('gmail')
    expect(detectProvider('ali@hotmail.com')).toBe('outlook')
    expect(detectProvider('ali@outlook.com.tr')).toBe('outlook')
    expect(detectProvider('ali@yandex.com.tr')).toBe('yandex')
    expect(detectProvider('ali@icloud.com')).toBe('icloud')
    expect(detectProvider('ali@ogr.uni.edu.tr')).toBe('custom')
  })
})

describe('taskFromMail', () => {
  it('konu başlık olur, gönderen notta, Inbox’a düşer', () => {
    const t = taskFromMail(env, 'gmail', 4)
    expect(t.title).toBe('TÜBİTAK ara rapor teslimi')
    expect(t.status).toBe('inbox')
    expect(t.areaId).toBe(4)
    expect(t.notes).toContain('Danışman Hoca <hoca@uni.edu.tr>')
    expect(t.firstStepType).toBe('url')
    expect(t.firstStepTarget).toBe(gmailLink('<CAB123@mail.gmail.com>'))
    expect(t.firstStepTarget).toContain('rfc822msgid%3ACAB123%40mail.gmail.com')
  })
  it('konusuz e-posta ve Gmail dışı sağlayıcı', () => {
    const t = taskFromMail({ ...env, subject: '' }, 'yandex', null)
    expect(t.title).toBe('Danışman Hoca adlı kişiden e-posta')
    expect(t.firstStepType).toBeNull()
    expect(t.firstStepTarget).toBeNull()
  })
})

describe('messageKey', () => {
  it('Message-ID yoksa uid', () => {
    expect(messageKey(env, '7')).toBe('<CAB123@mail.gmail.com>')
    expect(messageKey({ ...env, messageId: null }, '7')).toBe('uid:7:42')
  })
})

describe('searchSince', () => {
  const now = new Date('2026-10-09T12:00:00Z')
  const days = (d: Date): number => Math.round((now.getTime() - d.getTime()) / 86_400_000)
  it('ilk eşitlemede son 7 gün (eski e-postalar Inbox’ı doldurmaz)', () => {
    expect(days(searchSince('all', null, now))).toBe(7)
    expect(days(searchSince('flagged', null, now))).toBe(7)
  })
  it('sonra: yıldızlılarda 30 gün, diğerlerinde son eşitlemeden 1 gün önce', () => {
    expect(days(searchSince('flagged', '2026-10-09T11:50:00Z', now))).toBe(30)
    expect(days(searchSince('unread', '2026-10-09T11:50:00Z', now))).toBe(1)
    expect(days(searchSince('all', '2026-08-01T00:00:00Z', now))).toBe(30)
  })
})
