import Database from 'better-sqlite3'
import { runMigrations } from './migrate'
import { fold } from '../../shared/quickAdd'

/**
 * Profil başına ayrı SQLite dosyası. Giriş yapılınca `openDatabase` ile açılır, çıkışta kapanır.
 * Repository'ler `db`'yi doğrudan kullanmaya devam eder: `db` o anki profilin veritabanına yönlenen
 * bir vekildir. Giriş yapılmamışken herhangi bir sorgu "Giriş yapılmadı" hatası verir.
 */

let current: Database.Database | null = null
let currentPath: string | null = null

export class NotLoggedInError extends Error {
  constructor() {
    super('Giriş yapılmadı')
  }
}

function active(): Database.Database {
  if (!current) throw new NotLoggedInError()
  return current
}

export function openDatabase(path: string): Database.Database {
  closeDatabase()
  const conn = new Database(path)
  conn.pragma('journal_mode = WAL')
  // Arama dizini Türkçe karakterleri sadeleştirerek tutulur ("tubitak" = "TÜBİTAK").
  // FTS tetikleyicileri bu fonksiyonu kullandığı için migration'lardan önce tanımlanmalı.
  conn.function('cc_fold', { deterministic: true }, (value: unknown) => (typeof value === 'string' ? fold(value) : ''))
  runMigrations(conn)
  conn.pragma('foreign_keys = ON')
  current = conn
  currentPath = path
  return conn
}

export function closeDatabase(): void {
  if (!current) return
  try {
    current.pragma('wal_checkpoint(TRUNCATE)')
  } catch {
    // kapanışta checkpoint başarısız olsa da veri WAL'da güvende
  }
  current.close()
  current = null
  currentPath = null
}

export const isDatabaseOpen = (): boolean => current !== null
export const databasePath = (): string | null => currentPath

/**
 * `db.transaction(fn)` modül yüklenirken çağrılıyor; o an veritabanı henüz açık değil.
 * Bu yüzden sarmalayıcı, çağrıldığı anda o anki veritabanında işlemi açar.
 */
function lazyTransaction<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  return (...args: A) => active().transaction(fn)(...args)
}

export const db: Database.Database = new Proxy({} as Database.Database, {
  get(_target, prop) {
    if (prop === 'transaction') return lazyTransaction
    const conn = active()
    const value = Reflect.get(conn, prop, conn)
    return typeof value === 'function' ? value.bind(conn) : value
  }
})
