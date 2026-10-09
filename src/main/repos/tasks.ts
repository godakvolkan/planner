import { db } from '../db'
import { addDays, today, weekStart } from '../../shared/dates'
import type { MoveTarget, Priority, Task, TaskFilter, TaskInput, TaskPatch, TaskStatus } from '../../shared/types'
import { setTaskTags, tagsForTasks } from './tags'
import { fold } from '../../shared/quickAdd'

interface TaskRow {
  id: number
  title: string
  notes: string | null
  area_id: number | null
  status: TaskStatus
  priority: number
  deadline: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  planned_week: string | null
  estimate_min: number | null
  first_step: string | null
  first_step_target: string | null
  first_step_type: Task['firstStepType']
  top3_date: string | null
  postpone_count: number
  parent_id: number | null
  recurrence_id: number | null
  waiting_for: string | null
  follow_up_date: string | null
  created_at: string
  completed_at: string | null
  subtask_count: number
  subtask_done_count: number
  actual_min: number
  energy_level: Task['energyLevel']
  context: Task['context']
}

/** TaskInput alanı → tasks sütunu. update() sadece buradaki alanları yazar. */
const COLUMNS = {
  title: 'title',
  notes: 'notes',
  areaId: 'area_id',
  status: 'status',
  priority: 'priority',
  deadline: 'deadline',
  scheduledDate: 'scheduled_date',
  scheduledTime: 'scheduled_time',
  plannedWeek: 'planned_week',
  estimateMin: 'estimate_min',
  firstStep: 'first_step',
  firstStepTarget: 'first_step_target',
  firstStepType: 'first_step_type',
  parentId: 'parent_id',
  waitingFor: 'waiting_for',
  followUpDate: 'follow_up_date',
  energyLevel: 'energy_level',
  context: 'context'
} as const satisfies Record<Exclude<keyof TaskInput, 'tagIds'>, string>

const SELECT = `
  SELECT t.*,
    (SELECT COUNT(*) FROM tasks s WHERE s.parent_id = t.id) AS subtask_count,
    (SELECT COUNT(*) FROM tasks s WHERE s.parent_id = t.id AND s.status = 'done') AS subtask_done_count,
    (SELECT COALESCE(SUM(se.duration_min), 0) FROM sessions se WHERE se.task_id = t.id AND se.ended_at IS NOT NULL) AS actual_min
  FROM tasks t`

const ACTIVE = `t.status IN ('planned', 'active')`

function toTask(r: TaskRow, tags: Task['tags']): Task {
  return {
    id: r.id,
    title: r.title,
    notes: r.notes,
    areaId: r.area_id,
    status: r.status,
    priority: r.priority as Priority,
    deadline: r.deadline,
    scheduledDate: r.scheduled_date,
    scheduledTime: r.scheduled_time,
    plannedWeek: r.planned_week,
    estimateMin: r.estimate_min,
    firstStep: r.first_step,
    firstStepTarget: r.first_step_target,
    firstStepType: r.first_step_type,
    top3Date: r.top3_date,
    postponeCount: r.postpone_count,
    parentId: r.parent_id,
    recurrenceId: r.recurrence_id,
    waitingFor: r.waiting_for,
    followUpDate: r.follow_up_date,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    tags,
    subtaskCount: r.subtask_count,
    subtaskDoneCount: r.subtask_done_count,
    actualMin: r.actual_min,
    energyLevel: r.energy_level,
    context: r.context
  }
}

function hydrate(rows: TaskRow[]): Task[] {
  const tags = tagsForTasks(rows.map((r) => r.id))
  return rows.map((r) => toTask(r, tags.get(r.id) ?? []))
}

function validate(input: TaskPatch): void {
  if (input.title !== undefined && !input.title.trim()) throw new Error('Görev başlığı boş olamaz')
  if (input.priority !== undefined && ![1, 2, 3, 4].includes(input.priority)) throw new Error('Geçersiz öncelik')
  if (input.estimateMin != null && (!Number.isInteger(input.estimateMin) || input.estimateMin < 0)) {
    throw new Error('Tahmini süre pozitif bir tam sayı olmalı')
  }
}

export function getTask(id: number): Task | null {
  const row = db.prepare(`${SELECT} WHERE t.id = ?`).get(id) as TaskRow | undefined
  return row ? hydrate([row])[0] : null
}

function mustGet(id: number): Task {
  const task = getTask(id)
  if (!task) throw new Error(`Görev bulunamadı (#${id})`)
  return task
}

export function listTasks(filter: TaskFilter = {}): Task[] {
  const where: string[] = []
  const params: unknown[] = []
  let order = 't.priority DESC, t.id'
  const orderParams: unknown[] = []

  if (filter.parentId !== undefined) {
    where.push('t.parent_id = ?')
    params.push(filter.parentId)
    order = 't.id'
  } else {
    where.push('t.parent_id IS NULL')
  }

  if (filter.areaId !== undefined) {
    where.push('t.area_id = ?')
    params.push(filter.areaId)
  }

  const date = filter.date ?? today()
  switch (filter.view) {
    case 'inbox':
      where.push(`t.status = 'inbox'`)
      order = 't.created_at DESC, t.id DESC'
      break
    case 'today':
      // Bugüne planlananlar + geçmiş günden kalanlar + takip günü gelen bekleyenler
      where.push(`((${ACTIVE} AND t.scheduled_date <= ?) OR (t.status = 'waiting' AND t.follow_up_date <= ?))`)
      params.push(date, date)
      orderParams.push(date)
      order = `(t.top3_date = ?) DESC, t.scheduled_time IS NULL, t.scheduled_time, t.priority DESC, t.id`
      break
    case 'week': {
      const start = weekStart(date)
      where.push(`${ACTIVE} AND ((t.scheduled_date BETWEEN ? AND ?) OR t.planned_week = ?)`)
      params.push(start, addDays(start, 6), start)
      order = 't.scheduled_date IS NULL, t.scheduled_date, t.scheduled_time, t.priority DESC, t.id'
      break
    }
    case 'range':
      where.push(`t.status != 'archived' AND t.scheduled_date BETWEEN ? AND ?`)
      params.push(filter.from ?? date, filter.to ?? filter.from ?? date)
      order = 't.scheduled_date, t.scheduled_time IS NULL, t.scheduled_time, t.priority DESC, t.id'
      break
    case 'later':
      where.push(`t.status = 'planned' AND t.scheduled_date IS NULL AND t.planned_week IS NULL`)
      break
    case 'waiting':
      where.push(`t.status = 'waiting'`)
      order = 't.follow_up_date IS NULL, t.follow_up_date, t.id'
      break
    case 'done':
      where.push(`t.status = 'done'`)
      order = 't.completed_at DESC'
      break
    case 'all':
    case undefined:
      if (filter.parentId === undefined) where.push(`t.status != 'archived'`)
      break
  }

  const sql = `${SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order}`
  return hydrate(db.prepare(sql).all(...params, ...orderParams) as TaskRow[])
}

function defaultStatus(input: TaskInput): TaskStatus {
  if (input.status) return input.status
  if (input.parentId) return 'planned'
  return input.scheduledDate || input.plannedWeek ? 'planned' : 'inbox'
}

const createTaskTx = db.transaction((input: TaskInput): Task => {
  validate(input)
  const values: Record<string, unknown> = {
    ...Object.fromEntries(
      Object.entries(COLUMNS)
        .filter(([key]) => input[key as keyof typeof COLUMNS] !== undefined)
        .map(([key, col]) => [col, input[key as keyof typeof COLUMNS]])
    ),
    title: input.title.trim(),
    status: defaultStatus(input),
    priority: input.priority ?? 1,
    created_at: new Date().toISOString()
  }
  const cols = Object.keys(values)
  const info = db
    .prepare(`INSERT INTO tasks (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(values))
  const id = Number(info.lastInsertRowid)
  if (input.tagIds) setTaskTags(id, input.tagIds)
  return mustGet(id)
})

const updateTaskTx = db.transaction((id: number, patch: TaskPatch): Task => {
  mustGet(id)
  validate(patch)
  const entries = Object.entries(COLUMNS).filter(([key]) => patch[key as keyof typeof COLUMNS] !== undefined)
  if (entries.length) {
    const set = entries.map(([, col]) => `${col} = ?`).join(', ')
    const values = entries.map(([key]) => {
      const v = patch[key as keyof typeof COLUMNS]
      return key === 'title' && typeof v === 'string' ? v.trim() : v
    })
    db.prepare(`UPDATE tasks SET ${set} WHERE id = ?`).run(...values, id)
  }
  if (patch.tagIds) setTaskTags(id, patch.tagIds)
  return mustGet(id)
})

const deleteTaskTx = db.transaction((id: number): void => {
  const children = db.prepare('SELECT id FROM tasks WHERE parent_id = ?').all(id) as { id: number }[]
  for (const child of children) deleteTask(child.id)
  // 001 şemasındaki foreign key'lerde ON DELETE CASCADE yok, bağlı kayıtlar elle silinir
  for (const table of ['task_tags', 'sessions', 'time_blocks', 'postpone_log']) {
    db.prepare(`DELETE FROM ${table} WHERE task_id = ?`).run(id)
  }
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
})

function logHabit(recurrenceId: number, date: string, at: string): void {
  const rec = db.prepare('SELECT is_habit FROM recurrences WHERE id = ?').get(recurrenceId) as { is_habit: number } | undefined
  if (rec?.is_habit) db.prepare('INSERT OR IGNORE INTO habit_logs (recurrence_id, date, completed_at) VALUES (?, ?, ?)').run(recurrenceId, date, at)
}

export function completeTask(id: number): Task {
  const taskBefore = mustGet(id)
  const now = new Date().toISOString()
  db.prepare(`UPDATE tasks SET status = 'done', completed_at = ? WHERE id = ?`).run(now, id)
  
  // Alışkanlıksa o günün kaydı (zincir recurrences.ts'te kayıtlardan hesaplanır)
  if (taskBefore.recurrenceId) logHabit(taskBefore.recurrenceId, taskBefore.scheduledDate ?? today(), now)

  return mustGet(id)
}

export function uncompleteTask(id: number): Task {
  const task = mustGet(id)
  const status: TaskStatus = task.scheduledDate || task.plannedWeek || task.parentId ? 'planned' : 'inbox'
  db.prepare('UPDATE tasks SET status = ?, completed_at = NULL WHERE id = ?').run(status, id)

  if (task.recurrenceId) db.prepare('DELETE FROM habit_logs WHERE recurrence_id = ? AND date = ?').run(task.recurrenceId, task.scheduledDate ?? today())

  return mustGet(id)
}

const moveTaskTx = db.transaction((id: number, target: MoveTarget): Task => {
  const task = mustGet(id)
  const now = today()

  let scheduledDate: string | null = null
  let plannedWeek: string | null = null
  let status: TaskStatus = 'planned'
  switch (target.to) {
    case 'today':
      scheduledDate = now
      break
    case 'tomorrow':
      scheduledDate = addDays(now, 1)
      break
    case 'date':
      scheduledDate = target.date
      break
    case 'thisWeek':
      plannedWeek = weekStart(now)
      break
    case 'later':
      break
    case 'inbox':
      status = 'inbox'
      break
  }

  const old = task.scheduledDate
  // Tarihli bir görev daha ileri bir güne veya tarihsiz bir yere taşınırsa ertelenmiş sayılır
  const postponed = old !== null && (scheduledDate === null || scheduledDate > old)
  const keepTime = scheduledDate !== null && scheduledDate === old
  const top3 = task.top3Date && task.top3Date === scheduledDate ? task.top3Date : null

  db.prepare(
    `UPDATE tasks SET status = ?, scheduled_date = ?, planned_week = ?, scheduled_time = ?, top3_date = ?,
       completed_at = NULL, postpone_count = postpone_count + ? WHERE id = ?`
  ).run(status, scheduledDate, plannedWeek, keepTime ? task.scheduledTime : null, top3, postponed ? 1 : 0, id)

  if (postponed) {
    db.prepare('INSERT INTO postpone_log (task_id, date) VALUES (?, ?)').run(id, now)
  }
  return mustGet(id)
})

const setTop3Tx = db.transaction((id: number, date: string | null): Task => {
  const task = mustGet(id)
  if (date === null) {
    db.prepare('UPDATE tasks SET top3_date = NULL WHERE id = ?').run(id)
    return mustGet(id)
  }
  const { n } = db
    .prepare(`SELECT COUNT(*) AS n FROM tasks WHERE top3_date = ? AND id != ? AND status != 'done'`)
    .get(date, id) as { n: number }
  if (n >= 3) throw new Error('Bugünün 3’ü dolu')
  // "Bugünün 3'ü" olan görev o güne planlanmış olmalı
  const scheduledDate = task.scheduledDate === date ? task.scheduledDate : date
  db.prepare(`UPDATE tasks SET top3_date = ?, scheduled_date = ?, planned_week = NULL,
      status = CASE WHEN status IN ('inbox', 'done') THEN 'planned' ELSE status END WHERE id = ?`).run(date, scheduledDate, id)
  return mustGet(id)
})

export function createTask(input: TaskInput): Task {
  return createTaskTx(input)
}

export function updateTask(id: number, patch: TaskPatch): Task {
  return updateTaskTx(id, patch)
}

export function deleteTask(id: number): void {
  return deleteTaskTx(id)
}

export function moveTask(id: number, target: MoveTarget): Task {
  return moveTaskTx(id, target)
}

export function setTop3(id: number, date: string | null): Task {
  return setTop3Tx(id, date)
}

/** FTS5 araması: her kelime önek olarak eşleşir, sonuçlar bm25 skoruna göre */
export function searchTasks(query: string, limit = 50): Task[] {
  const tokens = fold(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8)
  if (!tokens.length) return []
  const match = tokens.map((t) => `"${t.replace(/"/g, '')}"*`).join(' AND ')
  const rows = db
    .prepare(
      `${SELECT} JOIN tasks_fts f ON f.rowid = t.id
       WHERE tasks_fts MATCH ? AND t.status != 'archived'
       ORDER BY (t.status = 'done'), bm25(tasks_fts), t.id DESC
       LIMIT ?`
    )
    .all(match, Math.min(Math.max(limit, 1), 200)) as TaskRow[]
  return hydrate(rows)
}

export function setWaiting(id: number, waitingFor: string, followUpDate: string | null): Task {
  mustGet(id)
  const who = waitingFor.trim()
  if (!who) throw new Error('Neyi beklediğini yaz')
  db.prepare(
    `UPDATE tasks SET status = 'waiting', waiting_for = ?, follow_up_date = ?, top3_date = NULL, completed_at = NULL WHERE id = ?`
  ).run(who, followUpDate, id)
  return mustGet(id)
}

const REASONS = new Set(['too_big', 'unclear', 'no_time', 'boring', 'not_important', 'other'])

export function setPostponeReason(id: number, reason: string): void {
  mustGet(id)
  if (!REASONS.has(reason)) throw new Error('Geçersiz neden')
  const last = db.prepare('SELECT id FROM postpone_log WHERE task_id = ? ORDER BY id DESC LIMIT 1').get(id) as { id: number } | undefined
  if (last) db.prepare('UPDATE postpone_log SET reason = ? WHERE id = ?').run(reason, last.id)
  else db.prepare('INSERT INTO postpone_log (task_id, date, reason) VALUES (?, ?, ?)').run(id, today(), reason)
}

const createSubtasksTx = db.transaction((parentId: number, steps: { title: string; estimateMin: number; scheduledDate: string | null }[]): Task[] => {
  const parent = mustGet(parentId)
  if (!steps.length) throw new Error('En az bir adım gerekli')
  return steps.map((s) =>
    createTask({
      title: s.title,
      parentId,
      estimateMin: s.estimateMin,
      areaId: parent.areaId,
      priority: parent.priority,
      scheduledDate: s.scheduledDate,
      status: 'planned'
    })
  )
})

export function createSubtasks(parentId: number, steps: { title: string; estimateMin: number; scheduledDate: string | null }[]): Task[] {
  return createSubtasksTx(parentId, steps)
}
