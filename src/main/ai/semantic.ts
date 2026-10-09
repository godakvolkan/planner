import { gemini } from './gemini'
import { listTasks, searchTasks } from '../repos/tasks'
import { today } from '../../shared/dates'
import { inRange, parseSearchIntent, sanitizeIntent, type SearchIntent } from '../../shared/semantic'
import type { Task } from '../../shared/types'

/**
 * "Geçen ayki vergi işi" gibi doğal dil aramaları.
 * Yapay zeka (varsa) yalnızca anahtar kelime + tarih aralığı çıkarır; asla SQL üretmez.
 * Arama her zaman mevcut FTS (Türkçe karakter duyarsız) üzerinden yapılır.
 */
export async function semanticSearch(query: string): Promise<Task[]> {
  const q = String(query ?? '').slice(0, 300)
  const t = today()
  let intent: SearchIntent = parseSearchIntent(q, t)

  if (gemini.available) {
    try {
      const prompt =
        `Bugün ${t}. Kullanıcı görev listesinde arama yapıyor. Sorgudan arama kelimelerini ve varsa tarih aralığını çıkar.\n` +
        `Sadece JSON döndür: {"keywords": ["..."], "from": "YYYY-MM-DD" | null, "to": "YYYY-MM-DD" | null}\n` +
        `Kelimeleri Türkçe kök haliyle ver, eş anlamlıları da ekleyebilirsin (en fazla 8).\n` +
        `Sorgu: ${JSON.stringify(q)}`
      const text = await gemini.generateContent(prompt)
      const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
      const ai = sanitizeIntent(JSON.parse(json))
      if (ai && ai.keywords.length) intent = { ...ai, from: ai.from ?? intent.from, to: ai.to ?? intent.to }
    } catch (e) {
      console.warn('Yapay zeka arama yorumu kullanılamadı, yerel çözümleme ile devam:', e)
    }
  }

  // Her kelime ayrı aranır, en çok kelimeyle eşleşen önce gelir
  const score = new Map<number, { task: Task; hits: number }>()
  for (const k of intent.keywords) {
    for (const task of searchTasks(k, 100)) {
      const cur = score.get(task.id)
      score.set(task.id, { task, hits: (cur?.hits ?? 0) + 1 })
    }
  }
  let results = [...score.values()].sort((a, b) => b.hits - a.hits).map((x) => x.task)
  // Yalnızca tarih ifadesi varsa ("geçen hafta ne yaptım") o aralıktaki görevler
  if (!intent.keywords.length && (intent.from || intent.to)) results = listTasks({ view: 'all' })
  return results.filter((x) => inRange(x, intent.from, intent.to)).slice(0, 50)
}
