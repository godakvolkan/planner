import type { Area } from '../../../shared/types'

/** Alan rengi: alanın seçili rengi (--area-1 … --area-8); eski kayıtlarda sıra numarasından */
export const AREA_COLORS = ['area-1', 'area-2', 'area-3', 'area-4', 'area-5', 'area-6', 'area-7', 'area-8']

export function areaColor(area: Area | undefined | null): string {
  if (!area) return 'var(--muted-foreground)'
  if (/^area-[1-8]$/.test(area.color)) return `var(--${area.color})`
  const slot = (((area.sort_order - 1) % 8) + 8) % 8 + 1
  return `var(--area-${slot})`
}

export function findArea(areas: Area[] | undefined, id: number | null | undefined): Area | undefined {
  if (!areas || id == null) return undefined
  return areas.find((a) => a.id === id)
}
