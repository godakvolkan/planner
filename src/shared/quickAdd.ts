import { addDays, isoWeekday, today } from './dates'
import type { Priority, TaskContext } from './types'
import { CONTEXTS } from './context'

/**
 * Tek satırlık Türkçe görev girişini ayrıştırır.
 *   "yarın 14:00 proje raporu 2 saat"  → başlık, tarih, saat, süre, alan
 *   "cuma ödev 45dk #üniversite !!"      → alan etiketi ve öncelik
 */
export interface ParsedQuickAdd {
  title: string
  scheduledDate: string | null
  scheduledTime: string | null
  estimateMin: number | null
  /** Eşleşen alanın adı (renderer alan listesinden id'ye çevirir) */
  areaName: string | null
  priority: Priority | null
  tags: string[]
  /** "@telefon", "@bilgisayar" … */
  context: TaskContext | null
}

export interface AreaRef {
  name: string
}

const WEEKDAYS: Record<string, number> = {
  pazartesi: 1, pzt: 1,
  salı: 2, sali: 2,
  çarşamba: 3, carsamba: 3, çrş: 3,
  perşembe: 4, persembe: 4,
  cuma: 5,
  cumartesi: 6, cmt: 6,
  pazar: 7
}

/** Başlıkta geçince alanı tahmin eden anahtar kelimeler (alan adı → kelimeler) */
const AREA_KEYWORDS: Record<string, string[]> = {
  'iş': ['toplantı', 'rapor', 'sunum', 'müşteri', 'proje'],
  'okul': ['ödev', 'odev', 'vize', 'final', 'ders', 'sınav', 'sinav', 'quiz', 'lab', 'hoca'],
  'yazılım': ['github', 'kod', 'api', 'react', 'nestjs', 'bug', 'readme', 'deploy', 'electron', 'commit', 'pr '],
  'kariyer': ['staj', 'cv', 'özgeçmiş', 'mülakat', 'linkedin', 'başvuru'],
  'kişisel': ['market', 'spor', 'fatura', 'doktor', 'alışveriş']
}

const trLower = (s: string): string => s.toLocaleLowerCase('tr-TR')

/** Türkçe karakterleri sadeleştirir: aramada "calisma" = "ÇALIŞMA" */
export function fold(s: string): string {
  return trLower(s)
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

const pad = (n: number): string => String(n).padStart(2, '0')

export interface ParseOptions {
  /** Sadece saat yazılırsa kullanılacak gün (ör. Bugün sayfası). Verilmezse saat geçtiyse yarın sayılır. */
  defaultDate?: string
}

export function parseQuickAdd(
  input: string,
  areas: AreaRef[] = [],
  now: Date = new Date(),
  options: ParseOptions = {}
): ParsedQuickAdd {
  const base = today(now)
  let text = ` ${input.trim()} `
  let scheduledDate: string | null = null
  let scheduledTime: string | null = null
  let estimateMin: number | null = null
  let priority: Priority | null = null
  let areaName: string | null = null
  const tags: string[] = []

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void): void => {
    const m = text.match(re)
    if (m && fn(m) !== false) text = text.replace(m[0], ' ')
  }

  // Süre: "2 saat", "1.5 saat", "1,5s", "45 dk", "45dk", "1s 30dk", "90 dakika"
  take(/\s(\d+(?:[.,]\d+)?)\s?(?:saat|sa|s)\s?(\d{1,2})\s?(?:dk|dakika|d)(?=\s)/i, (m) => {
    estimateMin = Math.round(parseFloat(m[1].replace(',', '.')) * 60) + Number(m[2])
  })
  if (estimateMin === null) {
    take(/\s(\d+(?:[.,]\d+)?)\s?(?:saat|sa|s)(?=\s)/i, (m) => {
      estimateMin = Math.round(parseFloat(m[1].replace(',', '.')) * 60)
    })
  }
  if (estimateMin === null) {
    take(/\s(\d{1,3})\s?(?:dk|dakika|dak)(?=\s)/i, (m) => {
      estimateMin = Number(m[1])
    })
  }

  // Saat: "14:00", "saat 14.30", "saat 9", "14:00'te". "12.10" tek başına tarihtir, saat değil.
  take(/\s(?:saat\s)?([01]?\d|2[0-3]):([0-5]\d)(?:'?(?:de|da|te|ta))?(?=\s)/i, (m) => {
    scheduledTime = `${pad(Number(m[1]))}:${m[2]}`
  })
  if (!scheduledTime) {
    take(/\ssaat\s([01]?\d|2[0-3])\.([0-5]\d)(?:'?(?:de|da|te|ta))?(?=\s)/i, (m) => {
      scheduledTime = `${pad(Number(m[1]))}:${m[2]}`
    })
  }
  if (!scheduledTime) {
    take(/\ssaat\s([01]?\d|2[0-3])(?:'?(?:de|da|te|ta))?(?=\s)/i, (m) => {
      scheduledTime = `${pad(Number(m[1]))}:00`
    })
  }

  // Tarih
  const lower = (): string => trLower(text)
  const dateWords: [RegExp, () => string][] = [
    [/\s(bugün|bugun)(?=\s)/, () => base],
    [/\s(yarın|yarin)(?=\s)/, () => addDays(base, 1)],
    [/\s(öbür gün|öbürgün|obur gun|ertesi gün)(?=\s)/, () => addDays(base, 2)],
    [/\s(haftaya)(?=\s)/, () => addDays(base, 7)]
  ]
  for (const [re, fn] of dateWords) {
    const m = lower().match(re)
    if (m && m.index !== undefined) {
      scheduledDate = fn()
      text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)
      break
    }
  }
  if (!scheduledDate) {
    const m = lower().match(/\s(pazartesi|pzt|salı|sali|çarşamba|carsamba|perşembe|persembe|cumartesi|cmt|cuma|pazar)(?:'?(?:ya|ye|a|e|da|de|ta|te|günü))?(?=\s)/)
    if (m && m.index !== undefined) {
      const target = WEEKDAYS[m[1]]
      const diff = (target - isoWeekday(base) + 7) % 7 || 7
      scheduledDate = addDays(base, diff)
      text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)
    }
  }
  if (!scheduledDate) {
    // "12.10" veya "12/10" → bu yıl (geçmişse gelecek yıl)
    take(/\s(\d{1,2})[./](\d{1,2})(?=\s)/, (m) => {
      const d = Number(m[1])
      const mo = Number(m[2])
      if (d < 1 || d > 31 || mo < 1 || mo > 12) return false
      let y = now.getFullYear()
      let candidate = `${y}-${pad(mo)}-${pad(d)}`
      if (candidate < base) candidate = `${++y}-${pad(mo)}-${pad(d)}`
      scheduledDate = candidate
      return true
    })
  }
  // Saat verildiyse ama gün verilmediyse: sayfanın günü; o da yoksa bugün (saat geçtiyse yarın)
  if (scheduledTime && !scheduledDate && options.defaultDate) scheduledDate = options.defaultDate
  if (scheduledTime && !scheduledDate) {
    const [h, mi] = (scheduledTime as string).split(':').map(Number)
    scheduledDate = h * 60 + mi < now.getHours() * 60 + now.getMinutes() ? addDays(base, 1) : base
  }

  // Öncelik: "!!!" acil, "!!" yüksek, "!" orta, "acil" kelimesi
  take(/\s(!{1,3})(?=\s)/, (m) => {
    priority = (m[1].length + 1) as Priority
  })
  if (!priority) {
    take(/\s(acil)(?=\s)/i, () => {
      priority = 4
    })
  }

  // @bağlam: "@telefon", "@bilgisayar", "@ev" …
  let context: TaskContext | null = null
  {
    const m = text.match(/\s@([\p{L}\p{N}_-]+)(?=\s)/u)
    if (m) {
      const word = fold(m[1])
      const hit = CONTEXTS.find((c) => fold(c.label) === word || c.keywords.includes(word) || fold(c.label).startsWith(word))
      if (hit) {
        context = hit.id
        text = text.replace(m[0], ' ')
      }
    }
  }

  // #alan veya #etiket
  for (;;) {
    const m = text.match(/\s#([\p{L}\p{N}_-]+)(?=\s)/u)
    if (!m) break
    const word = fold(m[1])
    const area = areas.find((a) => fold(a.name) === word || fold(a.name).startsWith(word))
    if (area && !areaName) areaName = area.name
    else tags.push(m[1])
    text = text.replace(m[0], ' ')
  }

  // Alan tahmini: başlıkta geçen anahtar kelimelerden
  if (!areaName && areas.length) {
    const folded = ` ${fold(text)} `
    for (const area of areas) {
      const name = fold(area.name)
      const keywords = [name, ...(AREA_KEYWORDS[trLower(area.name)] ?? []).map(fold)]
      if (keywords.some((k) => folded.includes(` ${k}`) || folded.includes(`${k} `))) {
        areaName = area.name
        break
      }
    }
  }

  // Başlık: kalan metin; "… yap" gibi sondaki dolgu fiili temizlenir
  let title = text.replace(/\s+/g, ' ').trim()
  title = title.replace(/\s(yap|yapılacak|bitir)$/i, (w) => (title.split(' ').length > 2 ? '' : w)).trim()
  if (title) title = title.charAt(0).toLocaleUpperCase('tr-TR') + title.slice(1)

  return { title, scheduledDate, scheduledTime, estimateMin, areaName, priority, tags, context }
}
