import type { Energy, Task } from './types'

/** Tahmini olmayan görev planlamada bu kadar sayılır */
export const DEFAULT_ESTIMATE = 30

const minutesOf = (time: string | null): number | null => {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export interface NowContext {
  date: string
  /** Günün dakikası (0–1439) */
  minuteOfDay: number
  activeTaskId: number | null
}

/**
 * "Şimdi ne?" puanlaması (ANTIGRAVITY_GOREV Faz 3, v1):
 *   çalışan oturum > saati gelmiş zaman bloğu > Bugünün 3'ü > deadline yakınlığı > öncelik > dünden kalan
 * Puanı yüksek olan önce gelir. Bitmiş ve bekleyen görevler listeye girmez.
 */
export function scoreTask(task: Task, ctx: NowContext, energy: Energy | null = null): number {
  if (task.id === ctx.activeTaskId) return 1_000_000
  let score = 0

  const start = minutesOf(task.scheduledTime)
  if (start !== null && task.scheduledDate === ctx.date) {
    const end = start + (task.estimateMin ?? DEFAULT_ESTIMATE)
    if (ctx.minuteOfDay >= start && ctx.minuteOfDay < end) score += 50_000 // şu an bu bloğun içindeyiz
    else if (ctx.minuteOfDay >= end) score += 20_000 // saati geçti, hâlâ yapılmadı
    else if (start - ctx.minuteOfDay <= 30) score += 15_000 // yarım saat içinde başlıyor
    else score -= 5_000 // ileri saate planlı: o saate kadar başka işler öne geçsin
  }

  if (task.top3Date === ctx.date) score += 10_000

  if (task.deadline) {
    const days = Math.round((Date.parse(task.deadline) - Date.parse(ctx.date)) / 86_400_000)
    if (days <= 0) score += 9_000
    else if (days <= 2) score += 6_000
    else if (days <= 7) score += 2_000
  }

  score += task.priority * 1_000
  if (task.scheduledDate && task.scheduledDate < ctx.date) score += 500 // dünden kalan
  score -= Math.min(task.postponeCount, 5) * 50 // çok ertelenen hafifçe geriler, kaybolmaz
  score += energyFit(task, energy)
  return score
}

/**
 * Günün enerjisine uyum (V2). Zaman bloğu ve Bugünün 3'ü kadar güçlü değildir; sadece eşit önemdekileri yeniden dizer.
 * Düşük enerjide küçük / kolay işler, yüksek enerjide büyük / zor işler öne çıkar.
 */
export function energyFit(task: Task, energy: Energy | null): number {
  if (!energy || energy === 'medium') return 0
  const est = task.estimateMin ?? DEFAULT_ESTIMATE
  const level = task.energyLevel ?? (est <= 20 ? 'low' : est >= 90 ? 'high' : 'medium')
  if (energy === 'low') return level === 'low' ? 2_500 : level === 'high' ? -3_000 : 0
  return level === 'high' ? 2_500 : level === 'low' ? -800 : 0
}

export function rankTasks(tasks: Task[], ctx: NowContext, energy: Energy | null = null): Task[] {
  return tasks
    .filter((t) => t.status === 'planned' || t.status === 'active')
    .map((t) => ({ t, s: scoreTask(t, ctx, energy) }))
    .sort((a, b) => b.s - a.s || a.t.id - b.t.id)
    .map((x) => x.t)
}

export interface BalanceSuggestion {
  task: Task
  reason: string
}

/**
 * "Günü dengele": kapasite aşılıyorsa yarına taşınabilecek görevleri önerir.
 * Korunanlar: Bugünün 3'ü, deadline'ı 2 gün içinde olanlar, saati verilmiş bloklar, çalışan oturum.
 * Önce en düşük öncelikli ve en büyük görevler önerilir. Hiçbir şeyi kendisi taşımaz.
 */
export function suggestBalance(tasks: Task[], capacityMin: number, ctx: NowContext): BalanceSuggestion[] {
  const open = tasks.filter((t) => t.status === 'planned' || t.status === 'active')
  let load = open.reduce((sum, t) => sum + (t.estimateMin ?? DEFAULT_ESTIMATE), 0)
  if (load <= capacityMin) return []

  const isProtected = (t: Task): boolean => {
    if (t.id === ctx.activeTaskId || t.top3Date === ctx.date || t.scheduledTime) return true
    if (!t.deadline) return false
    return (Date.parse(t.deadline) - Date.parse(ctx.date)) / 86_400_000 <= 2
  }

  const candidates = open
    .filter((t) => !isProtected(t))
    .sort((a, b) => a.priority - b.priority || (b.estimateMin ?? DEFAULT_ESTIMATE) - (a.estimateMin ?? DEFAULT_ESTIMATE))

  const result: BalanceSuggestion[] = []
  for (const task of candidates) {
    if (load <= capacityMin) break
    load -= task.estimateMin ?? DEFAULT_ESTIMATE
    const reason = task.priority === 1 ? 'Düşük öncelik' : task.deadline ? "Deadline'a zaman var" : 'Bugün için şart değil'
    result.push({ task, reason })
  }
  return result
}

export function totalEstimate(tasks: Task[]): number {
  return tasks.reduce((sum, t) => sum + (t.estimateMin ?? 0), 0)
}
