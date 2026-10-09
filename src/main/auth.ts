import { app } from 'electron'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { closeDatabase, openDatabase } from './db'
import type { ProfileInfo } from '../shared/types'

/**
 * Yerel profiller. Her profilin kendi klasörü ve veritabanı vardır: profiles/<id>/control_center.db
 * Şifre saklanmaz; scrypt (N=2^15) ile tuzlanmış özeti tutulur. Yanlış denemelerde artan bekleme uygulanır.
 */

interface ProfileRecord {
  id: string
  name: string
  /** Giriş için e-posta (küçük harf). Eski profillerde olmayabilir; o zaman adla girilir. */
  email?: string | null
  color: string
  hint: string | null
  salt: string
  hash: string
  createdAt: string
  lastLoginAt: string | null
}

interface Registry {
  version: 1
  profiles: ProfileRecord[]
}

const KEY_LEN = 64
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const COLORS = ['area-1', 'area-2', 'area-3', 'area-4', 'area-5', 'area-6', 'area-7', 'area-8']
export const MIN_PASSWORD = 4

let currentProfile: ProfileRecord | null = null
/** Bu oturum Google ile mi açıldı (şifre unutulduysa eski şifre sorulmadan yenisi belirlenebilir) */
let viaGoogle = false
const failures = new Map<string, { count: number; until: number }>()

const root = (): string => app.getPath('userData')
const registryPath = (): string => join(root(), 'profiles.json')
export const profileDir = (id: string): string => join(root(), 'profiles', id)
const dbFile = (id: string): string => join(profileDir(id), app.isPackaged ? 'control_center.db' : 'control_center.dev.db')

function readRegistry(): Registry {
  try {
    const r = JSON.parse(readFileSync(registryPath(), 'utf8')) as Registry
    if (r && Array.isArray(r.profiles)) return r
  } catch {
    // ilk açılış
  }
  return { version: 1, profiles: [] }
}

function writeRegistry(r: Registry): void {
  mkdirSync(root(), { recursive: true })
  const tmp = registryPath() + '.tmp'
  writeFileSync(tmp, JSON.stringify(r, null, 2), 'utf8')
  renameSync(tmp, registryPath()) // yarım yazılmış kayıt dosyası kalmasın
}

const hashPassword = (password: string, salt: string): string => scryptSync(password.normalize('NFC'), Buffer.from(salt, 'hex'), KEY_LEN, SCRYPT).toString('hex')

function verify(p: ProfileRecord, password: string): boolean {
  const a = Buffer.from(hashPassword(password, p.salt), 'hex')
  const b = Buffer.from(p.hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

const toInfo = (p: ProfileRecord): ProfileInfo => ({
  id: p.id,
  name: p.name,
  email: p.email ?? null,
  color: p.color,
  hint: p.hint,
  createdAt: p.createdAt,
  lastLoginAt: p.lastLoginAt
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const normalizeEmail = (email: string): string => email.trim().toLowerCase()

function validateEmail(email: string, reg: Registry, exceptId?: string): string {
  const e = normalizeEmail(email ?? '')
  if (!EMAIL_RE.test(e) || e.length > 120) throw new Error('Geçerli bir e-posta adresi yaz')
  if (reg.profiles.some((p) => p.id !== exceptId && p.email === e)) throw new Error('Bu e-postayla bir profil zaten var')
  return e
}

/** Girişte yazılan e-posta ya da (e-postası olmayan eski profiller için) profil adı */
function findByIdentifier(reg: Registry, identifier: string): ProfileRecord | undefined {
  const raw = (identifier ?? '').trim()
  if (!raw) return undefined
  const e = normalizeEmail(raw)
  return reg.profiles.find((p) => p.email === e) ?? reg.profiles.find((p) => p.name.toLocaleLowerCase('tr-TR') === raw.toLocaleLowerCase('tr-TR'))
}

export function listProfiles(): ProfileInfo[] {
  return readRegistry()
    .profiles.slice()
    .sort((a, b) => (b.lastLoginAt ?? b.createdAt).localeCompare(a.lastLoginAt ?? a.createdAt))
    .map(toInfo)
}

export const currentProfileInfo = (): ProfileInfo | null => (currentProfile ? { ...toInfo(currentProfile), viaGoogle } : null)
export const currentProfileId = (): string | null => currentProfile?.id ?? null
export const isLoggedIn = (): boolean => currentProfile !== null

/** Profiller gelmeden önceki tek veritabanı (varsa ilk profile taşınır) */
function legacyDbPath(): string | null {
  const p = join(root(), app.isPackaged ? 'control_center.db' : 'control_center.dev.db')
  return existsSync(p) ? p : null
}

export const hasLegacyData = (): boolean => readRegistry().profiles.length === 0 && legacyDbPath() !== null

function validateName(name: string, reg: Registry, exceptId?: string): string {
  const n = name.trim()
  if (!n) throw new Error('Profil adı boş olamaz')
  if (n.length > 40) throw new Error('Profil adı en fazla 40 karakter')
  if (reg.profiles.some((p) => p.id !== exceptId && p.name.toLocaleLowerCase('tr-TR') === n.toLocaleLowerCase('tr-TR'))) {
    throw new Error('Bu isimde bir profil zaten var')
  }
  return n
}

function validatePassword(password: string): void {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) throw new Error(`Şifre en az ${MIN_PASSWORD} karakter olmalı`)
  if (password.length > 200) throw new Error('Şifre çok uzun')
}

export interface CreateProfileInput {
  name: string
  email: string
  password: string
  hint?: string | null
}

export function createProfile(input: CreateProfileInput): ProfileInfo {
  const { name, email, password, hint = null } = input ?? ({} as CreateProfileInput)
  const reg = readRegistry()
  const cleanName = validateName(name ?? '', reg)
  const cleanEmail = validateEmail(email, reg)
  validatePassword(password)
  const id = randomUUID()
  const salt = randomBytes(16).toString('hex')
  const record: ProfileRecord = {
    id,
    name: cleanName,
    email: cleanEmail,
    color: COLORS[reg.profiles.length % COLORS.length],
    hint: hint?.trim().slice(0, 80) || null,
    salt,
    hash: hashPassword(password, salt),
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  }
  mkdirSync(profileDir(id), { recursive: true })
  // İlk profil: profillerden önceki veriler (görevler, ders programı…) bu profile taşınır
  const legacy = reg.profiles.length === 0 ? legacyDbPath() : null
  if (legacy) {
    for (const ext of ['', '-wal', '-shm']) if (existsSync(legacy + ext)) copyFileSync(legacy + ext, dbFile(id) + ext)
    const oldBackups = join(root(), 'backups')
    if (existsSync(oldBackups)) {
      try {
        renameSync(oldBackups, join(profileDir(id), 'backups'))
      } catch {
        // yedek klasörü taşınamazsa yerinde kalır
      }
    }
    // Asıl dosya kopyalandıktan sonra eskisi ".tasindi" olarak saklanır (silinmez)
    for (const ext of ['', '-wal', '-shm']) if (existsSync(legacy + ext)) renameSync(legacy + ext, legacy + ext + '.tasindi')
  }
  reg.profiles.push(record)
  writeRegistry(reg)
  return toInfo(record)
}

export interface LoginResult {
  ok: boolean
  error?: string
  /** Yanlış şifre bekleme süresi (sn) */
  retryInSec?: number
  profile?: ProfileInfo
}

/** Şifreyi bekleme sayacıyla doğrular; başarısızsa sonucu döner. Giriş ve silme aynı sayacı kullanır. */
function attempt(p: ProfileRecord, password: string): LoginResult | null {
  const id = p.id
  const f = failures.get(id)
  if (f && f.until > Date.now()) return { ok: false, error: 'Çok fazla yanlış deneme', retryInSec: Math.ceil((f.until - Date.now()) / 1000) }
  if (!verify(p, password ?? '')) {
    const count = (f?.count ?? 0) + 1
    // 3 yanlıştan sonra 5, 10, 20 … sn bekleme (en fazla 5 dk)
    const wait = count >= 3 ? Math.min(300, 5 * 2 ** (count - 3)) : 0
    failures.set(id, { count, until: Date.now() + wait * 1000 })
    return { ok: false, error: 'Şifre yanlış', retryInSec: wait || undefined }
  }
  failures.delete(id)
  return null
}

export function login(id: string, password: string): LoginResult {
  const reg = readRegistry()
  const p = reg.profiles.find((x) => x.id === id)
  if (!p) return { ok: false, error: 'Profil bulunamadı' }
  const denied = attempt(p, password)
  if (denied) return denied
  return open(reg, p)
}

const WRONG = 'E-posta ya da şifre yanlış'

/** E-posta (ya da eski profillerde ad) + şifre ile giriş. Hangi alanın yanlış olduğu söylenmez. */
export function loginWithIdentifier(identifier: string, password: string): LoginResult {
  const reg = readRegistry()
  const p = findByIdentifier(reg, identifier)
  if (!p) {
    hashPassword(password ?? '', randomBytes(16).toString('hex')) // kayıtlı olmayan e-posta da aynı sürede yanıtlansın
    return { ok: false, error: WRONG }
  }
  const denied = attempt(p, password)
  if (denied) return { ...denied, error: denied.error === 'Şifre yanlış' ? WRONG : denied.error }
  return open(reg, p)
}

/**
 * Google'ın doğruladığı e-postayla eşleşen profili açar (şifre sorulmaz).
 * Yalnızca main süreçteki Google akışı çağırır; IPC'ye açık değildir.
 */
export function loginWithVerifiedEmail(email: string): LoginResult {
  const reg = readRegistry()
  const p = reg.profiles.find((x) => x.email === normalizeEmail(email))
  if (!p) return { ok: false, error: 'Bu Google hesabına bağlı profil yok' }
  failures.delete(p.id)
  const r = open(reg, p)
  viaGoogle = true
  return { ...r, profile: currentProfileInfo()! }
}

/** "Şifremi unuttum": profilin ipucu (varsa) */
export function passwordHint(identifier: string): string | null {
  return findByIdentifier(readRegistry(), identifier)?.hint ?? null
}

function open(reg: Registry, p: ProfileRecord): LoginResult {
  const id = p.id
  closeDatabase()
  openDatabase(dbFile(id))
  p.lastLoginAt = new Date().toISOString()
  writeRegistry(reg)
  currentProfile = p
  viaGoogle = false
  return { ok: true, profile: toInfo(p) }
}

export function logout(): void {
  currentProfile = null
  viaGoogle = false
  closeDatabase()
}

export function changePassword(oldPassword: string, newPassword: string, hint?: string | null): void {
  if (!currentProfile) throw new Error('Giriş yapılmadı')
  const reg = readRegistry()
  const p = reg.profiles.find((x) => x.id === currentProfile!.id)!
  // Google ile açılmış oturumda (şifre unutulduğunda) eski şifre sorulmaz
  if (!viaGoogle && !verify(p, oldPassword ?? '')) throw new Error('Mevcut şifre yanlış')
  validatePassword(newPassword)
  p.salt = randomBytes(16).toString('hex')
  p.hash = hashPassword(newPassword, p.salt)
  if (hint !== undefined) p.hint = hint?.trim().slice(0, 80) || null
  writeRegistry(reg)
  currentProfile = p
}

/** Açık profilin giriş e-postası */
export function setEmail(email: string): ProfileInfo {
  if (!currentProfile) throw new Error('Giriş yapılmadı')
  const reg = readRegistry()
  const p = reg.profiles.find((x) => x.id === currentProfile!.id)!
  p.email = validateEmail(email, reg, p.id)
  writeRegistry(reg)
  currentProfile = p
  return toInfo(p)
}

export function renameProfile(name: string): ProfileInfo {
  if (!currentProfile) throw new Error('Giriş yapılmadı')
  const reg = readRegistry()
  const p = reg.profiles.find((x) => x.id === currentProfile!.id)!
  p.name = validateName(name, reg, p.id)
  writeRegistry(reg)
  currentProfile = p
  return toInfo(p)
}

/** Silmeden önce şifre onayı (girişle aynı bekleme sayacı) */
export function confirmDelete(id: string, password: string): void {
  const p = readRegistry().profiles.find((x) => x.id === id)
  if (!p) throw new Error('Profil bulunamadı')
  const denied = attempt(p, password)
  if (denied) throw new Error(denied.retryInSec ? `${denied.error} · ${denied.retryInSec} sn bekle` : denied.error)
}

/** Profili ve tüm verisini kalıcı siler (şifre ile onay). Açık profil silinirse oturum kapanır. */
export function deleteProfile(id: string, password: string): void {
  confirmDelete(id, password)
  const reg = readRegistry()
  if (currentProfile?.id === id) logout()
  reg.profiles = reg.profiles.filter((x) => x.id !== id)
  writeRegistry(reg)
  rmSync(profileDir(id), { recursive: true, force: true })
}
