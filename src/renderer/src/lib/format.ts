export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes) return ''
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h > 0 && m > 0) return `${h}s ${m}dk`
  if (h > 0) return `${h}s`
  return `${m}dk`
}

/** "0dk" yerine "—" göstermek istemediğimiz yerler için */
export function formatMinutesOrZero(minutes: number): string {
  return minutes > 0 ? formatMinutes(minutes) : '0dk'
}

const parse = (date: string): Date => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "Çarşamba · 7 Ekim" */
export function formatDayTitle(date: string): string {
  const d = parse(date)
  const weekday = d.toLocaleDateString('tr-TR', { weekday: 'long' })
  const day = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
  return `${weekday} · ${day}`
}

/** "7 Eki" */
export function formatShortDate(date: string): string {
  return parse(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export function weekdayShort(date: string): string {
  return parse(date).toLocaleDateString('tr-TR', { weekday: 'short' })
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours()
  if (h < 5) return 'İyi geceler'
  if (h < 12) return 'Günaydın'
  if (h < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

/** Bugüne göre göreli tarih: Bugün, Yarın, Dün, Cuma, 12 Eki */
export function relativeDay(date: string, todayStr: string): string {
  const diff = Math.round((parse(date).getTime() - parse(todayStr).getTime()) / 86_400_000)
  if (diff === 0) return 'Bugün'
  if (diff === 1) return 'Yarın'
  if (diff === -1) return 'Dün'
  if (diff > 1 && diff < 7) return parse(date).toLocaleDateString('tr-TR', { weekday: 'long' })
  return formatShortDate(date)
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
