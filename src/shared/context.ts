import type { Task, TaskContext } from './types'

/** Görevin yapılabileceği yer / araç. Boş bağlam = her yerde yapılabilir. */
export const CONTEXTS: { id: TaskContext; label: string; emoji: string; keywords: string[] }[] = [
  { id: 'computer', label: 'Bilgisayar', emoji: '💻', keywords: ['bilgisayar', 'pc', 'laptop'] },
  { id: 'phone', label: 'Telefon', emoji: '📱', keywords: ['telefon', 'tel', 'mobil', 'ara'] },
  { id: 'home', label: 'Ev', emoji: '🏠', keywords: ['ev', 'evde'] },
  { id: 'campus', label: 'Okul', emoji: '🎓', keywords: ['okul', 'kampus', 'universite', 'okulda'] },
  { id: 'online', label: 'İnternet', emoji: '🌐', keywords: ['internet', 'online', 'web'] },
  { id: 'people', label: 'İnsanlarla', emoji: '👥', keywords: ['insanlarla', 'yuzyuze', 'toplanti'] }
]

export const contextMeta = (id: TaskContext | null | undefined): (typeof CONTEXTS)[number] | undefined =>
  id ? CONTEXTS.find((c) => c.id === id) : undefined

/**
 * Şu anki bağlamda yapılabilir mi? Bağlamı olmayan görev her yerde yapılabilir.
 * Bilgisayar başındaysan internet işleri de yapılabilir; telefondaysan internet işleri de.
 */
export function fitsContext(task: Pick<Task, 'context'>, current: TaskContext | null): boolean {
  if (!current || !task.context) return true
  if (task.context === current) return true
  if (task.context === 'online' && (current === 'computer' || current === 'phone')) return true
  return false
}

export function filterByContext<T extends Pick<Task, 'context'>>(tasks: T[], current: TaskContext | null): T[] {
  return current ? tasks.filter((t) => fitsContext(t, current)) : tasks
}
