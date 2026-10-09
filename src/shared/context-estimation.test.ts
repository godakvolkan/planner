import { describe, expect, it } from 'vitest'
import { filterByContext, fitsContext } from './context'
import { buildProfile, suggestEstimate, type EstimationSample } from './estimation'
import { parseQuickAdd } from './quickAdd'

describe('bağlam', () => {
  it('bağlamsız görev her yerde yapılabilir', () => {
    expect(fitsContext({ context: null }, 'phone')).toBe(true)
    expect(fitsContext({ context: 'computer' }, null)).toBe(true)
  })
  it('farklı bağlam süzülür; internet işleri bilgisayar ve telefonda yapılabilir', () => {
    expect(fitsContext({ context: 'computer' }, 'phone')).toBe(false)
    expect(fitsContext({ context: 'online' }, 'phone')).toBe(true)
    expect(fitsContext({ context: 'online' }, 'home')).toBe(false)
    const list = [{ context: 'computer' as const }, { context: null }, { context: 'phone' as const }]
    expect(filterByContext(list, 'phone')).toHaveLength(2)
  })
  it('hızlı eklemede @bağlam', () => {
    const areas = [{ name: 'Deneyap' }]
    expect(parseQuickAdd('Deneyap grubuna mesaj @telefon', areas).context).toBe('phone')
    expect(parseQuickAdd('rapor yaz @bilgisayar 2 saat', areas)).toMatchObject({ context: 'computer', title: 'Rapor yaz', estimateMin: 120 })
    expect(parseQuickAdd('market listesi', areas).context).toBeNull()
  })
})

const s = (areaId: number | null, est: number, act: number): EstimationSample => ({ areaId, estimateMin: est, actualMin: act })

describe('tahmin çarpanı', () => {
  it('5 görevden az ise genel çarpan yok', () => {
    expect(buildProfile([s(1, 30, 45), s(1, 30, 45)]).overall).toBeNull()
  })
  it('medyan: aykırı değer çarpanı bozmaz, 10 kat üstü atılır', () => {
    const p = buildProfile([s(1, 60, 90), s(1, 60, 90), s(1, 60, 90), s(2, 30, 30), s(2, 30, 30), s(2, 10, 300)])
    expect(p.overall).toEqual({ ratio: 1.5, n: 5 })
    expect(p.byArea.find((a) => a.areaId === 1)?.ratio).toBe(1.5)
    expect(p.byArea.find((a) => a.areaId === 2)).toBeUndefined() // 2 geçerli örnek < 3
  })
  it('öneri: alan çarpanı öncelikli, 5 dakikaya yuvarlanır', () => {
    const p = buildProfile([s(1, 60, 90), s(1, 60, 90), s(1, 60, 90), s(2, 30, 30), s(2, 30, 30), s(2, 30, 30)])
    expect(suggestEstimate(p, 1, 60)).toMatchObject({ suggestedMin: 90, basis: 'area', ratio: 1.5 })
    expect(suggestEstimate(p, 2, 60)).toBeNull() // bu alanda tahminler iyi (1.0)
    expect(suggestEstimate(p, 9, 40)).toMatchObject({ basis: 'overall' })
  })
  it('tahminler iyiyse veya tahmin yoksa öneri yok', () => {
    const good = buildProfile([s(1, 30, 32), s(1, 30, 28), s(1, 30, 31), s(1, 30, 30), s(1, 30, 33)])
    expect(suggestEstimate(good, 1, 30)).toBeNull()
    expect(suggestEstimate(good, 1, null)).toBeNull()
  })
})
