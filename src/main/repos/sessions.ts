import { db } from '../db'
import type { ActiveSession } from '../../shared/types'

interface SessionRow {
  id: number
  task_id: number
  started_at: string
}

const toSession = (r: SessionRow): ActiveSession => ({ id: r.id, taskId: r.task_id, startedAt: r.started_at })

export function activeSession(): ActiveSession | null {
  const row = db
    .prepare('SELECT id, task_id, started_at FROM sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1')
    .get() as SessionRow | undefined
  return row ? toSession(row) : null
}

export function stopSession(): number {
  const active = activeSession()
  if (!active) return 0
  const now = new Date()
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(active.startedAt).getTime()) / 60000))
  db.prepare('UPDATE sessions SET ended_at = ?, duration_min = ? WHERE id = ?').run(now.toISOString(), minutes, active.id)
  return minutes
}

const startTx = db.transaction((taskId: number): ActiveSession => {
  if (!db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId)) throw new Error(`Görev bulunamadı (#${taskId})`)
  const active = activeSession()
  if (active?.taskId === taskId) return active
  stopSession()
  db.prepare('INSERT INTO sessions (task_id, started_at) VALUES (?, ?)').run(taskId, new Date().toISOString())
  return activeSession()!
})

export function startSession(taskId: number): ActiveSession {
  return startTx(taskId)
}
