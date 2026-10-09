import { app, shell } from 'electron'
import { createHash, randomBytes } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { join } from 'path'

/**
 * Google ile giriş (masaüstü uygulamaları için OAuth 2.0: sistem tarayıcısı + PKCE + 127.0.0.1 yönlendirme).
 * Şifre uygulamaya hiç gelmez; Google'dan yalnızca doğrulanmış e-posta ve ad alınır.
 *
 * İstemci kimliği şuradan okunur (ilk bulunan):
 *   1. GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ortam değişkenleri
 *   2. userData/google-oauth.json  ({ "client_id", "client_secret" } ya da Google Cloud'un indirdiği { "installed": { … } } biçimi)
 *   3. resources/google-oauth.json (kurulum dosyasıyla birlikte dağıtmak için)
 */

interface GoogleConfig {
  clientId: string
  clientSecret: string | null
}

export interface GoogleIdentity {
  email: string
  name: string | null
}

const TIMEOUT_MS = 3 * 60 * 1000
let running: Promise<GoogleIdentity> | null = null

function readConfigFile(path: string): GoogleConfig | null {
  try {
    if (!existsSync(path)) return null
    const raw = JSON.parse(readFileSync(path, 'utf8'))
    const c = raw.installed ?? raw.web ?? raw
    if (typeof c.client_id !== 'string' || !c.client_id) return null
    return { clientId: c.client_id, clientSecret: typeof c.client_secret === 'string' ? c.client_secret : null }
  } catch {
    return null
  }
}

export function googleConfig(): GoogleConfig | null {
  if (process.env.GOOGLE_CLIENT_ID) return { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? null }
  return (
    readConfigFile(join(app.getPath('userData'), 'google-oauth.json')) ??
    readConfigFile(join(app.getAppPath(), 'resources', 'google-oauth.json').replace('app.asar', 'app.asar.unpacked'))
  )
}

/** Giriş ekranı için: Google hazır mı, değilse istemci dosyası nereye konmalı */
export const googleSetup = (): { available: boolean; configPath: string } => ({
  available: googleConfig() !== null,
  configPath: join(app.getPath('userData'), 'google-oauth.json')
})

const b64url = (b: Buffer): string => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const PAGE = (title: string, body: string): string =>
  `<!doctype html><meta charset="utf-8"><title>Control Center</title>` +
  `<body style="margin:0;display:grid;place-items:center;height:100vh;background:#080c19;color:#edf1ff;font-family:Segoe UI,Inter,sans-serif">` +
  `<div style="text-align:center;max-width:420px;padding:24px"><h2 style="margin:0 0 8px">${title}</h2><p style="color:#a0aec9;line-height:1.6">${body}</p></div></body>`

/** Tarayıcıda Google girişi açar, kullanıcı dönünce doğrulanmış kimliği verir. Aynı anda tek akış. */
export function googleSignIn(): Promise<GoogleIdentity> {
  if (running) return running
  running = run().finally(() => {
    running = null
  })
  return running
}

async function run(): Promise<GoogleIdentity> {
  const config = googleConfig()
  if (!config) throw new Error('Google ile giriş yapılandırılmadı')

  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const state = b64url(randomBytes(16))

  let server: Server | null = null
  try {
    const { code, redirectUri } = await new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Google girişi zaman aşımına uğradı')), TIMEOUT_MS)
      server = createServer((req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        if (url.pathname !== '/') {
          res.writeHead(404).end()
          return
        }
        const error = url.searchParams.get('error')
        const got = url.searchParams.get('code')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        if (url.searchParams.get('state') !== state || (!got && !error)) {
          res.end(PAGE('Geçersiz istek', 'Bu bağlantı Control Center girişine ait değil.'))
          return
        }
        clearTimeout(timer)
        if (error || !got) {
          res.end(PAGE('Giriş iptal edildi', 'Control Center penceresine dönebilirsin.'))
          reject(new Error(error === 'access_denied' ? 'Google girişi iptal edildi' : `Google girişi başarısız (${error})`))
          return
        }
        res.end(PAGE('Giriş tamam ✓', 'Control Center penceresine dönebilirsin; bu sekmeyi kapatabilirsin.'))
        resolve({ code: got, redirectUri: `http://127.0.0.1:${(server!.address() as AddressInfo).port}` })
      })
      server.on('error', (e) => {
        clearTimeout(timer)
        reject(e)
      })
      // Yalnızca bu bilgisayardan erişilebilen, rastgele bir port
      server.listen(0, '127.0.0.1', () => {
        const port = (server!.address() as AddressInfo).port
        const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        auth.search = new URLSearchParams({
          client_id: config.clientId,
          redirect_uri: `http://127.0.0.1:${port}`,
          response_type: 'code',
          scope: 'openid email profile',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state,
          prompt: 'select_account'
        }).toString()
        shell.openExternal(auth.toString()).catch((e) => {
          clearTimeout(timer)
          reject(e)
        })
      })
    })

    const body = new URLSearchParams({ code, client_id: config.clientId, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier })
    if (config.clientSecret) body.set('client_secret', config.clientSecret)
    const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
    const token = (await res.json()) as { id_token?: string; error?: string; error_description?: string }
    if (!res.ok || !token.id_token) throw new Error(`Google girişi tamamlanamadı (${token.error_description ?? token.error ?? res.status})`)

    // id_token doğrudan Google'ın token adresinden TLS ile alındı; içeriği güvenilir (OpenID Connect 3.1.3.7)
    const payload = JSON.parse(Buffer.from(token.id_token.split('.')[1], 'base64url').toString('utf8')) as {
      email?: string
      email_verified?: boolean
      name?: string
      aud?: string
    }
    if (payload.aud !== config.clientId) throw new Error('Google yanıtı bu uygulamaya ait değil')
    if (!payload.email || payload.email_verified !== true) throw new Error('Google hesabının e-postası doğrulanmamış')
    return { email: payload.email.toLowerCase(), name: payload.name ?? null }
  } finally {
    ;(server as Server | null)?.close()
  }
}
