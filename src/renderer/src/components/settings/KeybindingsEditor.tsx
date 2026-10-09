import * as React from 'react'
import { AlertTriangle, Keyboard, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import {
  ACTIONS,
  SCOPE_LABEL,
  actionLabel,
  comboFromEvent,
  findConflict,
  formatCombo,
  validateCombo,
  type ActionId,
  type KeyScope
} from '../../../../shared/keybindings'
import type { ShortcutStatus } from '../../../../shared/types'
import { KeyCombo } from '@/components/common/KeyCombo'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/app-context'
import { recording } from '@/lib/data'
import { cn } from '@/lib/utils'

const SCOPES: KeyScope[] = ['global', 'app', 'task']

/**
 * Klavye kısayollarını düzenleme: bir satıra tıkla, yeni tuş kombinasyonuna bas.
 * Esc vazgeçer. Çakışma varsa kaydetmeden önce sorar ve diğer eylemi varsayılanına döndürmeyi önerir.
 */
export function KeybindingsEditor({ status, onChanged }: { status: ShortcutStatus | undefined; onChanged: () => void }): React.JSX.Element {
  const { bindings, settings, updateSettings } = useApp()
  const [editing, setEditing] = React.useState<ActionId | null>(null)
  const [pending, setPending] = React.useState<string | null>(null)
  const [problem, setProblem] = React.useState<{ text: string; conflict: ActionId | null } | null>(null)
  const overrides = settings.keybindings ?? {}

  const stop = React.useCallback(() => {
    setEditing((cur) => {
      if (cur && ACTIONS.find((a) => a.id === cur)?.scope === 'global') window.api.shortcuts.suspend(false).then(onChanged, () => undefined)
      return null
    })
    setPending(null)
    setProblem(null)
    recording.active = false
  }, [onChanged])

  const save = React.useCallback(
    async (id: ActionId, combo: string, alsoReset?: ActionId): Promise<void> => {
      const next: Record<string, string> = { ...(overrides as Record<string, string>), [id]: combo }
      if (alsoReset) delete next[alsoReset]
      try {
        await updateSettings({ keybindings: next })
        toast.success(`${actionLabel(id)}: ${formatCombo(combo)}`)
        stop()
        onChanged()
      } catch (e) {
        setProblem({ text: e instanceof Error ? e.message.replace(/^.*Error: /, '') : 'Kaydedilemedi.', conflict: null })
      }
    },
    [overrides, updateSettings, stop, onChanged]
  )

  // Kayıt modundayken bütün tuşları yakala; diğer kısayollar tetiklenmesin
  React.useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) return stop()
      const combo = comboFromEvent(e)
      if (!combo) return
      setPending(combo)
      const invalid = validateCombo(editing, combo)
      if (invalid) return setProblem({ text: invalid, conflict: null })
      const conflict = findConflict(bindings, editing, combo)
      if (conflict) return setProblem({ text: `${formatCombo(combo)} zaten "${actionLabel(conflict)}" için kullanılıyor.`, conflict })
      save(editing, combo)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [editing, bindings, save, stop])

  React.useEffect(() => () => {
    recording.active = false
  }, [])

  const start = async (id: ActionId): Promise<void> => {
    recording.active = true
    setEditing(id)
    setPending(null)
    setProblem(null)
    // Global kısayolu kaydederken mevcut global kısayollar araya girmesin
    if (ACTIONS.find((a) => a.id === id)?.scope === 'global') await window.api.shortcuts.suspend(true).catch(() => undefined)
  }

  const reset = async (id: ActionId): Promise<void> => {
    const next = { ...(overrides as Record<string, string>) }
    delete next[id]
    try {
      await updateSettings({ keybindings: next })
      onChanged()
      toast(`${actionLabel(id)} varsayılana döndü`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message.replace(/^.*Error: /, '') : 'Sıfırlanamadı.')
    }
  }

  const resetAll = async (): Promise<void> => {
    try {
      await updateSettings({ keybindings: {} })
      onChanged()
      toast.success('Tüm kısayollar varsayılana döndü')
    } catch {
      toast.error('Sıfırlanamadı.')
    }
  }

  const changed = Object.keys(overrides).length

  return (
    <div>
      {status?.error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-[12.5px]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>{status.error}</span>
        </div>
      )}
      <div className="space-y-5">
        {SCOPES.map((scope) => (
          <div key={scope}>
            <div className="section-label mb-1.5 px-1">{SCOPE_LABEL[scope]}</div>
            <div className="divide-y divide-border/60 rounded-xl border">
              {ACTIONS.filter((a) => a.scope === scope).map((a) => {
                const isEditing = editing === a.id
                const isChanged = a.id in overrides
                return (
                  <div key={a.id} className={cn('group px-3 py-2', isEditing && 'bg-primary/[0.06]')}>
                    <div className="flex items-center gap-3">
                      <span className="flex-1 text-[13px]">
                        {a.label}
                        {isChanged && <span className="ml-2 text-[11px] text-primary">değiştirildi</span>}
                      </span>
                      {isEditing ? (
                        <span className="flex items-center gap-2 text-[12.5px] font-medium text-primary">
                          {pending ? <KeyCombo combo={pending} size="md" /> : <span className="animate-pulse">Yeni kısayola bas…</span>}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => start(a.id)}
                          title="Değiştirmek için tıkla"
                          className="rounded-lg px-1.5 py-1 transition-colors hover:bg-accent"
                        >
                          <KeyCombo combo={bindings[a.id]} size="md" />
                        </button>
                      )}
                      {isEditing ? (
                        <Button variant="ghost" size="sm" onClick={stop}>
                          Vazgeç
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${a.label} varsayılana dön`}
                          title={`Varsayılan: ${formatCombo(a.default)}`}
                          disabled={!isChanged}
                          className="opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-0"
                          onClick={() => reset(a.id)}
                        >
                          <RotateCcw />
                        </Button>
                      )}
                    </div>
                    {isEditing && problem && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                        <span className="text-warning">{problem.text}</span>
                        {problem.conflict && pending && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7"
                            onClick={() => {
                              const other = problem.conflict!
                              const fallback = ACTIONS.find((x) => x.id === other)!.default
                              // Diğer eylem varsayılanına dönünce de çakışıyorsa kaydetme
                              if (fallback === pending) {
                                setProblem({ text: `"${actionLabel(other)}" bu tuşun varsayılan sahibi; önce onu başka bir tuşa ata.`, conflict: null })
                                return
                              }
                              save(editing, pending, other)
                            }}
                          >
                            Yine de ata, "{actionLabel(problem.conflict)}" varsayılana dönsün
                          </Button>
                        )}
                      </div>
                    )}
                    {isEditing && !problem && <div className="mt-1 text-[11.5px] text-muted-foreground">Esc: vazgeç</div>}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Keyboard className="size-3.5" /> Bir kısayolu değiştirmek için üstüne tıkla ve yeni tuşlara bas.
        </span>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={changed === 0} onClick={resetAll}>
          <RotateCcw className="size-3.5" /> Tümünü varsayılana döndür
        </Button>
      </div>
    </div>
  )
}
