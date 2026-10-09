import * as React from 'react'
import { Search, Sparkles, Loader2 } from 'lucide-react'
import { fold } from '../../../shared/quickAdd'
import { Page, Section, EmptyState } from '@/components/common/Page'
import { TaskRow } from '@/components/task/TaskRow'
import { useData } from '@/lib/data'
import { Task } from '../../../shared/types'

export function PageSearch(): React.JSX.Element {
  const [q, setQ] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 120)
    return () => clearTimeout(id)
  }, [q])
  const [aiMode, setAiMode] = React.useState(false)
  const [aiLoading, setAiLoading] = React.useState(false)
  const [aiHits, setAiHits] = React.useState<Task[] | null>(null)

  const all = useData(() => window.api.tasks.list({ view: 'all' })).data ?? []
  // Boşken açık görevler; yazınca SQLite FTS5 tam metin arama (kelime başı, Türkçe karakter duyarsız)
  const hits = useData(() => (debounced && !aiMode ? window.api.tasks.search(debounced, 100) : Promise.resolve(null)), [debounced, aiMode]).data
  const tagHits = debounced && !aiMode ? all.filter((t) => t.tags.some((x) => fold(x.name).startsWith(fold(debounced.replace(/^#/, ''))))) : []
  
  const merged = aiMode ? (aiHits ?? []) : (hits ? [...hits, ...tagHits.filter((t) => !hits.some((h) => h.id === t.id))] : all)
  const openHits = merged.filter((t) => t.status !== 'done')
  const doneHits = aiMode && aiHits ? aiHits.filter((t) => t.status === 'done') : (hits ? merged.filter((t) => t.status === 'done') : [])

  const runAiSearch = async () => {
    if (!q.trim()) return
    setAiMode(true)
    setAiLoading(true)
    try {
      const results = await window.api.ai.semanticSearch(q)
      setAiHits(results)
    } catch (e) {
      console.error(e)
      setAiHits([])
    } finally {
      setAiLoading(false)
    }
  }

  // AI modundan çıkış
  React.useEffect(() => {
    if (aiMode && debounced !== q.trim()) {
      // Kullanıcı yeni bir şey yazarsa AI modundan normal aramaya dön (veya yeniden AI tetiklemeli, ama manuel daha iyi)
      setAiMode(false)
      setAiHits(null)
    }
  }, [q, aiMode])

  return (
    <Page title="Ara" subtitle="Başlık, not, ilk adım ve etiketlerde arar · Türkçe karakter fark etmez · SQLite FTS5">
      <div className="surface flex items-center gap-3 px-4 focus-within:border-ring/50">
        <Search className={`size-4 ${aiMode ? 'text-brand' : 'text-muted-foreground'}`} />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) runAiSearch()
          }}
          placeholder="örn. proje · Ctrl+Enter: “geçen ayki vergi işi”"
          className={`h-12 flex-1 bg-transparent text-[14.5px] outline-none ${aiMode ? 'text-brand font-medium' : 'placeholder:text-muted-foreground/70'}`}
        />
        <button 
          onClick={runAiSearch}
          disabled={aiLoading || !q.trim()}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          title="Ctrl + Enter · doğal dille ara: “geçen ayki vergi işi”, “bu hafta proje”"
        >
          {aiLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-brand" />}
          Akıllı ara
        </button>
      </div>
      <Section title="Açık" count={openHits.length}>
        {openHits.length === 0 ? (
          <EmptyState icon={Search} title="Eşleşen açık görev yok." />
        ) : (
          <div className="flex flex-col gap-0.5">
            {openHits.map((t) => (
              <TaskRow key={t.id} task={t} showDate />
            ))}
          </div>
        )}
      </Section>
      {doneHits.length > 0 && (
        <Section title="Tamamlanan" count={doneHits.length}>
          <div className="flex flex-col gap-0.5">
            {doneHits.map((t) => (
              <TaskRow key={t.id} task={t} showDate />
            ))}
          </div>
        </Section>
      )}
    </Page>
  )
}
