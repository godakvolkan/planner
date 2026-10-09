import { db } from '../db'
import type { Area, AreaInput } from '../../shared/types'

const COLOR = /^area-[1-8]$/

export function listAreas(): Area[] {
  return db.prepare('SELECT id, name, icon, color, sort_order FROM areas ORDER BY sort_order, id').all() as Area[]
}

function mustGet(id: number): Area {
  const row = db.prepare('SELECT id, name, icon, color, sort_order FROM areas WHERE id = ?').get(id) as Area | undefined
  if (!row) throw new Error(`Alan bulunamadı (#${id})`)
  return row
}

function validate(input: Partial<AreaInput>): void {
  if (input.name !== undefined && !input.name.trim()) throw new Error('Alan adı boş olamaz')
  if (input.name !== undefined && input.name.trim().length > 40) throw new Error('Alan adı en fazla 40 karakter')
  if (input.color !== undefined && !COLOR.test(input.color)) throw new Error('Geçersiz renk')
}

export function createArea(input: AreaInput): Area {
  validate(input)
  const name = input.name.trim()
  if (db.prepare('SELECT 1 FROM areas WHERE name = ? COLLATE NOCASE').get(name)) throw new Error('Bu isimde bir alan zaten var')
  const { next } = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM areas').get() as { next: number }
  const color = input.color ?? `area-${((next - 1) % 8) + 1}`
  const info = db
    .prepare('INSERT INTO areas (name, icon, color, sort_order) VALUES (?, ?, ?, ?)')
    .run(name, input.icon?.trim() || '📁', color, next)
  return mustGet(Number(info.lastInsertRowid))
}

export function updateArea(id: number, patch: Partial<AreaInput>): Area {
  mustGet(id)
  validate(patch)
  if (patch.name !== undefined) {
    const clash = db.prepare('SELECT 1 FROM areas WHERE name = ? COLLATE NOCASE AND id != ?').get(patch.name.trim(), id)
    if (clash) throw new Error('Bu isimde bir alan zaten var')
    db.prepare('UPDATE areas SET name = ? WHERE id = ?').run(patch.name.trim(), id)
  }
  if (patch.icon !== undefined) db.prepare('UPDATE areas SET icon = ? WHERE id = ?').run(patch.icon.trim() || '📁', id)
  if (patch.color !== undefined) db.prepare('UPDATE areas SET color = ? WHERE id = ?').run(patch.color, id)
  return mustGet(id)
}

const deleteTx = db.transaction((id: number) => {
  mustGet(id)
  // 001 şemasında ON DELETE yok: bağlı kayıtlar alansız bırakılır
  db.prepare('UPDATE tasks SET area_id = NULL WHERE area_id = ?').run(id)
  db.prepare('UPDATE recurrences SET area_id = NULL WHERE area_id = ?').run(id)
  db.prepare('UPDATE fixed_events SET area_id = NULL WHERE area_id = ?').run(id)
  db.prepare('DELETE FROM areas WHERE id = ?').run(id)
})

export function deleteArea(id: number): void {
  deleteTx(id)
}

const reorderTx = db.transaction((ids: number[]) => {
  const update = db.prepare('UPDATE areas SET sort_order = ? WHERE id = ?')
  ids.forEach((id, i) => update.run(i + 1, id))
})

export function reorderAreas(ids: number[]): Area[] {
  reorderTx(ids)
  return listAreas()
}
