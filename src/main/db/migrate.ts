import { app, dialog } from 'electron'
import type { Database } from 'better-sqlite3'
import migration001 from './migrations/001_initial.sql?raw'
import migration002 from './migrations/002_seed_areas.sql?raw'
import migration003 from './migrations/003_planning_fields.sql?raw'
import migration004 from './migrations/004_schedule_notifications.sql?raw'
import migration005 from './migrations/005_search_waiting.sql?raw'
import migration006 from './migrations/006_habits_email.sql?raw'
import migration007 from './migrations/007_mail_accounts.sql?raw'

// Yeni migration: dosyayı ekle, buraya sıradaki numarayla yaz. Eski dosyalar asla değiştirilmez.
const migrations = [
  { version: 1, sql: migration001 },
  { version: 2, sql: migration002 },
  { version: 3, sql: migration003 },
  { version: 4, sql: migration004 },
  { version: 5, sql: migration005 },
  { version: 6, sql: migration006 },
  { version: 7, sql: migration007 }
]

export function runMigrations(db: Database): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)')

  const row = db.prepare('SELECT MAX(version) AS version FROM schema_version').get() as { version: number | null }
  const currentVersion = row.version ?? 0

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue
    try {
      db.transaction(() => {
        db.exec(migration.sql)
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version)
      })()
    } catch (err) {
      console.error('MIGRATION ERROR:', err)
      const detail = err instanceof Error ? err.message : String(err)
      dialog.showErrorBox(
        'Veritabanı güncellenemedi',
        `Verilerin güvende, hiçbir şey silinmedi. Uygulama kapatılacak.\n\nGeliştirici detayı (sürüm ${migration.version}): ${detail}`
      )
      app.exit(1)
      throw err
    }
  }
}
