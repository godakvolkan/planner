import * as React from 'react'
import { matchesCombo } from '../../../shared/keybindings'

/** Renderer içinde bir değişiklik olunca tüm ekranların veriyi yenilemesi için */
const REFRESH = 'cc:refresh'

export function refreshAll(): void {
  window.dispatchEvent(new Event(REFRESH))
}

/**
 * Veriyi yükler; main'den `data:changed` gelince veya `refreshAll()` çağrılınca yeniden yükler.
 * Önceki veri yenileme sırasında ekranda kalır (titreme olmaz).
 */
export function useData<T>(load: () => Promise<T>, deps: React.DependencyList = []): {
  data: T | undefined
  error: unknown
  reload: () => void
} {
  const [data, setData] = React.useState<T>()
  const [error, setError] = React.useState<unknown>(null)
  const loadRef = React.useRef(load)
  loadRef.current = load

  const reload = React.useCallback(() => {
    loadRef
      .current()
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch(setError)
  }, [])

  React.useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  React.useEffect(() => {
    const off = window.api.onDataChanged(reload)
    window.addEventListener(REFRESH, reload)
    return () => {
      off()
      window.removeEventListener(REFRESH, reload)
    }
  }, [reload])

  return { data, error, reload }
}

/** Her dakika (veya verilen aralıkta) yeniden çizim; saat çizgisi ve sayaçlar için */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** Ayarlarda yeni kısayol kaydedilirken diğer kısayollar susar */
export const recording = { active: false }

const isTyping = (el: EventTarget | null): boolean => {
  const h = el as HTMLElement | null
  return !!h && (h.tagName === 'INPUT' || h.tagName === 'TEXTAREA' || h.tagName === 'SELECT' || h.isContentEditable)
}

/**
 * Uygulama içi kısayol (shared/keybindings biçiminde, ör. "Control+K" veya "N").
 * Ctrl/Alt/Win içermeyen tek tuşlar yazı yazarken ve açık bir diyalog varken çalışmaz.
 */
export function useShortcut(combo: string, handler: (e: KeyboardEvent) => void, enabled = true): void {
  const ref = React.useRef(handler)
  ref.current = handler
  React.useEffect(() => {
    if (!enabled || !combo) return
    const single = !/(Control|Alt|Meta)\+/.test(combo)
    const onKey = (e: KeyboardEvent): void => {
      if (recording.active || e.defaultPrevented) return
      if (single && (isTyping(e.target) || document.querySelector('[role="dialog"]'))) return
      if (matchesCombo(e, combo)) {
        e.preventDefault()
        ref.current(e)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [combo, enabled])
}
