import * as React from 'react'

/** Kenar çubuğu düzeni: geniş pencerede tam, orta genişlikte ikon şeridi, dar pencerede çekmece */
export type LayoutMode = 'full' | 'rail' | 'drawer'

export const RAIL_BELOW = 1080
export const DRAWER_BELOW = 640

const modeFor = (w: number): LayoutMode => (w < DRAWER_BELOW ? 'drawer' : w < RAIL_BELOW ? 'rail' : 'full')

export function useLayout(): LayoutMode {
  const [mode, setMode] = React.useState<LayoutMode>(() => modeFor(window.innerWidth))
  React.useEffect(() => {
    const onResize = (): void => setMode(modeFor(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return mode
}

/** Pencere genişliği belirli bir değerin altında mı (yeniden boyutlandırmada güncellenir) */
export function useNarrow(below: number): boolean {
  const [narrow, setNarrow] = React.useState(() => window.innerWidth < below)
  React.useEffect(() => {
    const onResize = (): void => setNarrow(window.innerWidth < below)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [below])
  return narrow
}
