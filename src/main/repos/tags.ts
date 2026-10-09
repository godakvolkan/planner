import { db } from '../db'
import type { Tag } from '../../shared/types'

export function listTags(): Tag[] {
  return db.prepare('SELECT id, name FROM tags ORDER BY name COLLATE NOCASE').all() as Tag[]
}

/** Aynı isimde etiket varsa onu döner */
export function createTag(name: string): Tag {
  const clean = name.trim().replace(/^[#@]/, '')
  if (!clean) throw new Error('Etiket adı boş olamaz')
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(clean)
  return db.prepare('SELECT id, name FROM tags WHERE name = ?').get(clean) as Tag
}

export function tagsForTasks(taskIds: number[]): Map<number, Tag[]> {
  const result = new Map<number, Tag[]>()
  if (!taskIds.length) return result
  const rows = db
    .prepare(
      `SELECT tt.task_id, t.id, t.name FROM task_tags tt JOIN tags t ON t.id = tt.tag_id
       WHERE tt.task_id IN (${taskIds.map(() => '?').join(',')}) ORDER BY t.name COLLATE NOCASE`
    )
    .all(...taskIds) as { task_id: number; id: number; name: string }[]
  for (const r of rows) {
    const list = result.get(r.task_id) ?? []
    list.push({ id: r.id, name: r.name })
    result.set(r.task_id, list)
  }
  return result
}

export function setTaskTags(taskId: number, tagIds: number[]): void {
  db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(taskId)
  const insert = db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)')
  for (const tagId of new Set(tagIds)) insert.run(taskId, tagId)
}
