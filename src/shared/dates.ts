// Yerel saatle çalışan tarih yardımcıları. Tarihler 'YYYY-MM-DD' string'idir.
// toISOString() kullanılmaz: UTC'ye çevirdiği için Türkiye'de gece 00:00–03:00 arası bir önceki günü verir.

const pad = (n: number): string => String(n).padStart(2, '0')

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function today(now: Date = new Date()): string {
  return toDateString(now)
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date)
  d.setDate(d.getDate() + days)
  return toDateString(d)
}

/** 1 = Pazartesi … 7 = Pazar */
export function isoWeekday(date: string): number {
  const day = parseDate(date).getDay()
  return day === 0 ? 7 : day
}

/** Tarihin bulunduğu haftanın pazartesi günü */
export function weekStart(date: string): string {
  return addDays(date, 1 - isoWeekday(date))
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate()
}
