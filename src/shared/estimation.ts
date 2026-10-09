/**
 * Kişisel tahmin çarpanı (EK_OZELLIKLER §2.2).
 * Tamamlanmış, hem tahmini hem ölçülen süresi olan görevlerde gerçek / tahmin oranının medyanı.
 * Aykırı değerlerin (unutulup açık kalan sayaç vb.) etkisini azaltmak için ortalama değil medyan kullanılır.
 */

export interface EstimationSample {
  areaId: number | null
  estimateMin: number
  actualMin: number
}

export interface EstimationProfile {
  overall: { ratio: number; n: number } | null
  byArea: { areaId: number | null; ratio: number; n: number }[]
}

/** Genel çarpan için en az bu kadar görev gerekir */
export const MIN_SAMPLES = 5
/** Alan çarpanı için */
export const MIN_AREA_SAMPLES = 3

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function buildProfile(samples: EstimationSample[]): EstimationProfile {
  // 1 dakikadan kısa ölçümler ve 10 kattan büyük sapmalar (açık unutulmuş sayaç) hesaba katılmaz
  const valid = samples.filter((s) => s.estimateMin > 0 && s.actualMin >= 1 && s.actualMin / s.estimateMin <= 10)
  const ratio = (xs: EstimationSample[]): number => Math.round(median(xs.map((s) => s.actualMin / s.estimateMin)) * 100) / 100
  const groups = new Map<number | null, EstimationSample[]>()
  for (const s of valid) groups.set(s.areaId, [...(groups.get(s.areaId) ?? []), s])
  return {
    overall: valid.length >= MIN_SAMPLES ? { ratio: ratio(valid), n: valid.length } : null,
    byArea: [...groups.entries()]
      .filter(([, xs]) => xs.length >= MIN_AREA_SAMPLES)
      .map(([areaId, xs]) => ({ areaId, ratio: ratio(xs), n: xs.length }))
      .sort((a, b) => Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1))
  }
}

export interface EstimateHint {
  ratio: number
  suggestedMin: number
  /** Hangi veriden: alan mı genel mi */
  basis: 'area' | 'overall'
  n: number
}

/**
 * Yeni tahmin için öneri. Alan çarpanı varsa o, yoksa genel çarpan.
 * Çarpan 0.8–1.2 arasındaysa (tahminler zaten iyi) öneri yapılmaz. Öneri 5 dakikaya yuvarlanır.
 */
export function suggestEstimate(profile: EstimationProfile | null | undefined, areaId: number | null, estimateMin: number | null): EstimateHint | null {
  if (!profile || !estimateMin || estimateMin <= 0) return null
  const area = profile.byArea.find((a) => a.areaId === areaId)
  const source = area ? { ratio: area.ratio, n: area.n, basis: 'area' as const } : profile.overall ? { ...profile.overall, basis: 'overall' as const } : null
  if (!source || (source.ratio >= 0.8 && source.ratio <= 1.2)) return null
  const suggestedMin = Math.max(5, Math.round((estimateMin * source.ratio) / 5) * 5)
  if (suggestedMin === estimateMin) return null
  return { ratio: source.ratio, suggestedMin, basis: source.basis, n: source.n }
}
