import { DEFAULT_ESTIMATE, rankTasks, type NowContext } from './planning'
import { fold } from './quickAdd'
import type { Energy, Task } from './types'

// ------------------------------------------------------------------ Kaç dakikam var?

export interface TimePlan {
  tasks: Task[]
  totalMin: number
  freeMin: number
}

/**
 * Verilen boş süreye en iyi sığan görev kombinasyonu (0/1 sırt çantası).
 * Değer, "Şimdi ne?" sıralamasındaki yerden gelir: üstteki görevler daha değerli.
 * Kısa pencerelerde (≤ 30 dk) küçük işler hafifçe öne çıkar, büyük bir işi yarım bırakmaktansa
 * birkaç küçük işi bitirmek daha iyi hissettirir. Bloğun dışına taşan görev seçilmez.
 */
export function fitToTime(tasks: Task[], minutes: number, ctx: NowContext, energy: Energy | null = null): TimePlan {
  const ranked = rankTasks(tasks, ctx, energy).filter((t) => !t.scheduledTime || t.scheduledDate !== ctx.date || t.id === ctx.activeTaskId)
  const budget = Math.max(0, Math.floor(minutes))
  const items = ranked
    .map((t, i) => ({ t, w: Math.max(5, t.estimateMin ?? DEFAULT_ESTIMATE), v: 1000 / (i + 1) + (budget <= 30 && (t.estimateMin ?? DEFAULT_ESTIMATE) <= 15 ? 150 : 0) }))
    .filter((x) => x.w <= budget)
    .slice(0, 60)

  // dp[c] = (değer, seçilenler); 5 dakikalık adımlar yeterli hassasiyet
  const step = 5
  const cap = Math.floor(budget / step)
  const best: { v: number; pick: number[] }[] = Array.from({ length: cap + 1 }, () => ({ v: 0, pick: [] }))
  items.forEach((it, idx) => {
    const w = Math.ceil(it.w / step)
    for (let c = cap; c >= w; c--) {
      const cand = best[c - w].v + it.v
      if (cand > best[c].v) best[c] = { v: cand, pick: [...best[c - w].pick, idx] }
    }
  })
  const chosen = best[cap].pick.map((i) => items[i].t)
  // Sıralamadaki yerine göre diz: önemli olan önce
  chosen.sort((a, b) => ranked.indexOf(a) - ranked.indexOf(b))
  const totalMin = chosen.reduce((s, t) => s + (t.estimateMin ?? DEFAULT_ESTIMATE), 0)
  return { tasks: chosen, totalMin, freeMin: budget - totalMin }
}

// ------------------------------------------------------------------ Görev parçalama

export interface StepSuggestion {
  title: string
  estimateMin: number
}

const TEMPLATES: { match: RegExp; steps: [string, number][] }[] = [
  { match: /rapor|tez|makale|bildiri|2209|sonuc raporu/, steps: [['Kaynakları ve verileri topla', 0.2], ['Taslak başlıkları çıkar', 0.1], ['Ana bölümleri yaz', 0.35], ['Grafik ve tabloları hazırla', 0.15], ['Son okuma ve düzeltme', 0.2]] },
  { match: /odev|proje odevi|lab|deney/, steps: [['Soruları / yönergeyi oku', 0.1], ['Gerekli kaynakları bul', 0.15], ['Çözümü yap', 0.5], ['Kontrol et ve teslim et', 0.25]] },
  { match: /sunum|slayt|seminer|ders hazirlik|hazirligi/, steps: [['Akışı ve ana mesajları belirle', 0.2], ['Slaytları hazırla', 0.45], ['Görselleri ekle', 0.15], ['Prova yap', 0.2]] },
  { match: /sinav|vize|final|calis/, steps: [['Konuları listele', 0.1], ['Konu tekrarı', 0.45], ['Soru çöz', 0.35], ['Eksikleri gözden geçir', 0.1]] },
  { match: /api|kod|uygulama|feature|ozellik|bug|refactor|github|site|electron|react/, steps: [['Gereksinimleri netleştir', 0.15], ['Tasarım / plan', 0.15], ['Kodla', 0.45], ['Test et', 0.15], ['Commit ve PR', 0.1]] },
  { match: /basvuru|staj|cv|ozgecmis|linkedin/, steps: [['İlanları / şartları topla', 0.25], ['CV ve metni güncelle', 0.4], ['Başvuruları gönder', 0.25], ['Takip listesi yap', 0.1]] }
]

/** Büyük görev için alt görev önerisi; toplam süre tahmini korur, adımlar 5 dakikaya yuvarlanır */
export function suggestBreakdown(title: string, estimateMin: number | null): StepSuggestion[] {
  const total = Math.max(30, estimateMin ?? 120)
  const key = fold(title)
  const template = TEMPLATES.find((t) => t.match.test(key))
  const round = (m: number): number => Math.max(5, Math.round(m / 5) * 5)
  if (template) return template.steps.map(([t, share]) => ({ title: t, estimateMin: round(total * share) }))
  // Şablon yoksa: başlangıç + eşit çalışma blokları (en fazla 45 dk) + bitiriş
  const blocks = Math.max(1, Math.round((total - 20) / 45))
  const each = round((total - 20) / blocks)
  return [
    { title: 'Başlamak için ilk adımı belirle', estimateMin: 5 },
    ...Array.from({ length: blocks }, (_, i) => ({ title: `Çalışma bloğu ${i + 1}`, estimateMin: each })),
    { title: 'Toparla ve bitir', estimateMin: 15 }
  ]
}

/** Bu görev parçalanmalı mı? (90 dk üstü veya 2+ kez ertelenmiş ve alt görevi yok) */
export function isLarge(task: Task): boolean {
  return task.subtaskCount === 0 && ((task.estimateMin ?? 0) > 90 || task.postponeCount >= 2)
}

/**
 * Alt görevleri günlere dağıtır: her gün kapasitenin en fazla yarısı bu işe ayrılır, sıra korunur.
 * Teslim tarihi verilirse son adım o günü geçmez (sığmıyorsa son güne yığılır, kullanıcıya gösterilir).
 */
export function spreadOverDays(
  steps: StepSuggestion[],
  startDate: string,
  dailyMinutes: (date: string) => number,
  addDays: (date: string, n: number) => string,
  deadline: string | null = null
): { date: string; step: StepSuggestion }[] {
  const out: { date: string; step: StepSuggestion }[] = []
  let date = startDate
  let used = 0
  for (const step of steps) {
    const limit = Math.max(30, Math.floor(dailyMinutes(date) / 2))
    if (used > 0 && used + step.estimateMin > limit && (!deadline || date < deadline)) {
      date = addDays(date, 1)
      used = 0
      // Kapasitesi olmayan günleri atla (en fazla 14 gün)
      for (let i = 0; i < 14 && dailyMinutes(date) === 0 && (!deadline || date < deadline); i++) date = addDays(date, 1)
    }
    out.push({ date, step })
    used += step.estimateMin
  }
  return out
}

// ------------------------------------------------------------------ Erteleme nedeni

export type PostponeReason = 'too_big' | 'unclear' | 'no_time' | 'boring' | 'not_important' | 'other'

export const POSTPONE_REASONS: { id: PostponeReason; label: string; advice: string }[] = [
  { id: 'too_big', label: 'Çok büyük', advice: 'Küçük parçalara bölelim; ilk parça 30 dakikayı geçmesin.' },
  { id: 'unclear', label: 'Nereden başlayacağımı bilmiyorum', advice: 'İlk fiziksel adımı yaz: "Word dosyasını aç" kadar küçük.' },
  { id: 'no_time', label: 'Vaktim olmadı', advice: 'Takvimde ona bir saat ayır; boş kalırsa iş de bekler.' },
  { id: 'boring', label: 'Sıkıcı', advice: '25 dakikalık tek bir odak bloğu dene, sonrası serbest.' },
  { id: 'not_important', label: 'Artık önemli değil', advice: 'Önceliğini düşür ya da sil; listeni hafiflet.' },
  { id: 'other', label: 'Başka bir şey', advice: 'Not olarak yaz, yarın daha net görürsün.' }
]
