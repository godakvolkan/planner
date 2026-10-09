import { addDays, daysInMonth, parseDate, toDateString, weekStart } from './dates'
import { fold } from './quickAdd'

/** "geçen ayki vergi işi" → anahtar kelimeler + tarih aralığı. SQL üretmez; arama her zaman FTS ile yapılır. */
export interface SearchIntent {
  keywords: string[]
  from: string | null
  to: string | null
}

// Aramada anlam taşımayan sözcükler (katlanmış biçimde: ı→i, ş→s …)
const STOP = new Set(
  [
    'bir', 've', 'ile', 'icin', 'olan', 'su', 'bu', 'o', 'de', 'da', 'mi', 'mu', 'ne', 'hangi', 'gibi', 'kadar',
    'is', 'isi', 'isler', 'isleri', 'gorev', 'gorevi', 'gorevler', 'gorevleri', 'sey', 'seyi', 'olan', 'yaptigim',
    'yapacagim', 'yapilacak', 'bul', 'getir', 'goster', 'ara', 'hani', 'su', 'sunu', 'bana', 'benim',
    'gecen', 'gecenki', 'bu', 'onceki', 'ay', 'ayki', 'ayin', 'hafta', 'haftaki', 'haftanin', 'gun', 'gunku',
    'dun', 'dunku', 'bugun', 'bugunku', 'yarin', 'yarinki', 'yil', 'yilki', 'sene', 'seneki'
  ].map(fold)
)

const DATE_PHRASES: { re: RegExp; range: (today: string) => [string, string] }[] = [
  { re: /\bgecen ay/, range: (t) => monthRange(t, -1) },
  { re: /\bbu ay/, range: (t) => monthRange(t, 0) },
  { re: /\bgecen hafta/, range: (t) => [addDays(weekStart(t), -7), addDays(weekStart(t), -1)] },
  { re: /\bbu hafta/, range: (t) => [weekStart(t), addDays(weekStart(t), 6)] },
  { re: /\bdun/, range: (t) => [addDays(t, -1), addDays(t, -1)] },
  { re: /\bbugun/, range: (t) => [t, t] },
  { re: /\byarin/, range: (t) => [addDays(t, 1), addDays(t, 1)] },
  { re: /\bgecen (yil|sene)/, range: (t) => [`${Number(t.slice(0, 4)) - 1}-01-01`, `${Number(t.slice(0, 4)) - 1}-12-31`] }
]

function monthRange(today: string, offset: number): [string, string] {
  const d = parseDate(today)
  const first = new Date(d.getFullYear(), d.getMonth() + offset, 1)
  const y = first.getFullYear()
  const m = first.getMonth() + 1
  return [toDateString(first), `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth(y, m)).padStart(2, '0')}`]
}

/** Yapay zeka olmadan sorgudan niyet çıkarır */
export function parseSearchIntent(query: string, today: string): SearchIntent {
  const f = fold(query)
  let from: string | null = null
  let to: string | null = null
  for (const p of DATE_PHRASES) {
    if (p.re.test(f)) {
      ;[from, to] = p.range(today)
      break
    }
  }
  const keywords = [...new Set(f.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !STOP.has(w)))].slice(0, 8)
  return { keywords, from, to }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Yapay zekadan gelen JSON'u doğrular; geçersizse null (bu durumda yerel çözümleme kullanılır) */
export function sanitizeIntent(raw: unknown): SearchIntent | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.keywords)) return null
  const keywords = [
    ...new Set(
      r.keywords
        .filter((k): k is string => typeof k === 'string')
        .flatMap((k) => fold(k).split(/[^\p{L}\p{N}]+/u))
        .filter((w) => w.length >= 2)
    )
  ].slice(0, 8)
  const date = (v: unknown): string | null => (typeof v === 'string' && ISO_DATE.test(v) ? v : null)
  return { keywords, from: date(r.from), to: date(r.to) }
}

/** Görevin tarih aralığına düşüp düşmediği: planlandığı, tamamlandığı ya da eklendiği gün */
export function inRange(task: { scheduledDate: string | null; completedAt: string | null; createdAt: string }, from: string | null, to: string | null): boolean {
  if (!from && !to) return true
  const days = [task.scheduledDate, task.completedAt && toDateString(new Date(task.completedAt)), toDateString(new Date(task.createdAt))]
  return days.some((d) => !!d && (!from || d >= from) && (!to || d <= to))
}
