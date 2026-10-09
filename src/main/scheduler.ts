import { generateInstances } from './repos/recurrences'

/**
 * Açılışta ve her gece yarısından hemen sonra tekrar görevlerini üretir.
 * Bilgisayar uykudan uyanınca kaçırılan gün de yakalansın diye dakikada bir gün değişimi kontrol edilir.
 */
export function startScheduler(onChange: () => void): () => void {
  let lastDay = new Date().toDateString()

  const run = (): void => {
    if (generateInstances() > 0) onChange()
  }
  run()

  const timer = setInterval(() => {
    const day = new Date().toDateString()
    if (day === lastDay) return
    lastDay = day
    run()
    // Gün değişti: "bugün" görünümleri yenilenmeli
    onChange()
  }, 60_000)

  return () => clearInterval(timer)
}
