import { describe, expect, it } from 'vitest'
import { fold, parseQuickAdd } from './quickAdd'

const AREAS = ['Okul', 'Yazılım', 'İş', 'Kişisel'].map((name) => ({ name }))
// 7 Ekim 2026 Çarşamba, 10:00
const NOW = new Date(2026, 9, 7, 10, 0)
const p = (s: string) => parseQuickAdd(s, AREAS, NOW)

describe('parseQuickAdd', () => {
  it('görev dosyasındaki örnek: yarın 14:00 İş raporunu 2 saat yap', () => {
    const r = p('yarın 14:00 İş raporunu 2 saat yap')
    expect(r.title).toBe('İş raporunu')
    expect(r.scheduledDate).toBe('2026-10-08')
    expect(r.scheduledTime).toBe('14:00')
    expect(r.estimateMin).toBe(120)
    expect(r.areaName).toBe('İş')
  })

  it('süre biçimleri', () => {
    expect(p('rapor 45 dk').estimateMin).toBe(45)
    expect(p('rapor 45dk').estimateMin).toBe(45)
    expect(p('rapor 1.5 saat').estimateMin).toBe(90)
    expect(p('rapor 1,5 saat').estimateMin).toBe(90)
    expect(p('rapor 1s 30dk').estimateMin).toBe(90)
    expect(p('rapor 90 dakika').estimateMin).toBe(90)
  })

  it('haftanın günü: bir sonraki o gün (bugün çarşamba ise "çarşamba" gelecek hafta)', () => {
    expect(p('cuma ödev').scheduledDate).toBe('2026-10-09')
    expect(p("pazartesiye sunum").scheduledDate).toBe('2026-10-12')
    expect(p('çarşamba toplantı').scheduledDate).toBe('2026-10-14')
  })

  it('bugün / öbür gün / tarih', () => {
    expect(p('bugün mail').scheduledDate).toBe('2026-10-07')
    expect(p('öbür gün mail').scheduledDate).toBe('2026-10-09')
    expect(p('12.10 vize').scheduledDate).toBe('2026-10-12')
    expect(p('12.10 vize').scheduledTime).toBeNull()
    expect(p('01.03 rapor').scheduledDate).toBe('2027-03-01') // geçmiş tarih → gelecek yıl
  })

  it('sadece saat verilirse bugün; saat geçtiyse yarın', () => {
    expect(p('15:00 toplantı').scheduledDate).toBe('2026-10-07')
    expect(p('09:00 standup').scheduledDate).toBe('2026-10-08')
    expect(p('saat 9 standup').scheduledTime).toBe('09:00')
    // Bugün sayfasında yazılan geçmiş saat yine bugündür
    expect(parseQuickAdd('09:00 standup', AREAS, NOW, { defaultDate: '2026-10-07' }).scheduledDate).toBe('2026-10-07')
    expect(p('saat 14.30 ders').scheduledTime).toBe('14:30')
  })

  it('öncelik ve etiket', () => {
    expect(p('rapor !!!').priority).toBe(4)
    expect(p('rapor !!').priority).toBe(3)
    expect(p('acil fatura öde').priority).toBe(4)
    const r = p('sunum #iş #slayt')
    expect(r.areaName).toBe('İş')
    expect(r.tags).toEqual(['slayt'])
    expect(r.title).toBe('Sunum')
  })

  it('anahtar kelimeden alan tahmini', () => {
    expect(p('Veri yapıları ödevi').areaName).toBe('Üniversite')
    expect(p('GitHub README düzenle').areaName).toBe('Yazılım')
    expect(p('staj başvurusu').areaName).toBe('Kariyer')
    expect(p('kitap oku').areaName).toBeNull()
  })

  it('tarihsiz ve süresiz giriş sadece başlıktır (Inbox)', () => {
    const r = p('react native kütüphanesine bak')
    expect(r).toMatchObject({ title: 'React native kütüphanesine bak', scheduledDate: null, scheduledTime: null, estimateMin: null })
  })

  it('"2209" gibi sayılar süre veya saat sanılmaz', () => {
    const r = p('2209 sonuç raporu')
    expect(r.estimateMin).toBeNull()
    expect(r.scheduledTime).toBeNull()
    expect(r.title).toBe('2209 sonuç raporu')
    expect(r.areaName).toBe('TÜBİTAK')
  })
})

describe('fold', () => {
  it('Türkçe karakterleri sadeleştirir', () => {
    expect(fold('TÜBİTAK')).toBe('tubitak')
    expect(fold('Çarşamba Işık Göğüs')).toBe('carsamba isik gogus')
  })
})
