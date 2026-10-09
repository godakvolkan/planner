/**
 * Düzenlenebilir klavye kısayolları.
 * Kısayollar Electron accelerator biçiminde saklanır: "Control+Shift+K", "Alt+Space", "X", "Delete".
 * Böylece global kısayollar doğrudan globalShortcut.register'a verilebilir.
 */

export type KeyScope = 'global' | 'app' | 'task'

export const ACTIONS = [
  // Her yerden (uygulama arka plandayken de)
  { id: 'quickAdd', label: 'Hızlı görev ekle penceresi', scope: 'global', default: 'Control+Space' },
  { id: 'focusGlobal', label: 'Focus ekranını aç', scope: 'global', default: 'Control+Shift+F' },
  // Uygulama içinde
  { id: 'palette', label: 'Ara ve komut paleti', scope: 'app', default: 'Control+K' },
  { id: 'navNow', label: 'Şimdi', scope: 'app', default: 'Control+1' },
  { id: 'navToday', label: 'Bugün', scope: 'app', default: 'Control+2' },
  { id: 'navInbox', label: 'Inbox', scope: 'app', default: 'Control+3' },
  { id: 'navPlanner', label: 'Planlayıcı', scope: 'app', default: 'Control+4' },
  { id: 'navSchedule', label: 'Ders programı', scope: 'app', default: 'Control+5' },
  { id: 'navAreas', label: 'Alanlar', scope: 'app', default: 'Control+6' },
  { id: 'navFocus', label: 'Focus', scope: 'app', default: 'Control+7' },
  { id: 'navAnalytics', label: 'Analiz', scope: 'app', default: 'Control+8' },
  { id: 'navSettings', label: 'Ayarlar', scope: 'app', default: 'Control+,' },
  { id: 'newTask', label: 'Yeni görev yaz', scope: 'app', default: 'N' },
  { id: 'lock', label: 'Kilitle (giriş ekranına dön)', scope: 'app', default: 'Control+L' },
  // Seçili görev (listede bir görev seçiliyken)
  { id: 'taskOpen', label: 'Görevi aç', scope: 'task', default: 'Enter' },
  { id: 'taskComplete', label: 'Tamamla / geri al', scope: 'task', default: 'X' },
  { id: 'taskFocus', label: 'Odaklan', scope: 'task', default: 'F' },
  { id: 'taskToday', label: 'Bugüne al', scope: 'task', default: 'B' },
  { id: 'taskTomorrow', label: 'Yarına taşı', scope: 'task', default: 'Y' },
  { id: 'taskWeek', label: 'Bu haftaya al', scope: 'task', default: 'H' },
  { id: 'taskLater', label: 'Sonraya bırak', scope: 'task', default: 'S' },
  { id: 'taskTop3', label: "Bugünün 3'ü", scope: 'task', default: '3' },
  { id: 'taskWaiting', label: 'Bekliyor olarak işaretle', scope: 'task', default: 'W' },
  { id: 'taskDelete', label: 'Sil', scope: 'task', default: 'Delete' }
] as const satisfies readonly { id: string; label: string; scope: KeyScope; default: string }[]

export type ActionId = (typeof ACTIONS)[number]['id']
export type Bindings = Record<ActionId, string>

export const SCOPE_LABEL: Record<KeyScope, string> = {
  global: 'Her yerden (uygulama arka plandayken de çalışır)',
  app: 'Uygulama içinde',
  task: 'Seçili görevde'
}

const MODIFIERS = ['Control', 'Alt', 'Shift', 'Meta'] as const

export function defaultBindings(): Bindings {
  return Object.fromEntries(ACTIONS.map((a) => [a.id, a.default])) as Bindings
}

/** Kayıtlı değişiklikleri varsayılanların üstüne uygular; bilinmeyen veya bozuk değerler atlanır */
export function resolveBindings(overrides: Partial<Record<string, string>> | null | undefined): Bindings {
  const result = defaultBindings()
  for (const a of ACTIONS) {
    const v = overrides?.[a.id]
    if (typeof v === 'string' && v.trim()) result[a.id] = normalizeCombo(v)
  }
  return result
}

/** Değiştirici sırasını sabitler, takma adları birleştirir: "shift+ctrl+k" → "Control+Shift+K" */
export function normalizeCombo(combo: string): string {
  const parts = combo.split('+').map((p) => p.trim()).filter(Boolean)
  // "Control++" gibi artı tuşu
  if (combo.endsWith('++')) parts.push('Plus')
  const mods = new Set<string>()
  let key = ''
  for (const raw of parts) {
    const p = raw.toLowerCase()
    if (p === 'ctrl' || p === 'control' || p === 'cmdorctrl' || p === 'commandorcontrol') mods.add('Control')
    else if (p === 'alt' || p === 'option') mods.add('Alt')
    else if (p === 'shift') mods.add('Shift')
    else if (p === 'meta' || p === 'super' || p === 'cmd' || p === 'command' || p === 'win') mods.add('Meta')
    else key = normalizeKey(raw)
  }
  return [...MODIFIERS.filter((m) => mods.has(m)), key].filter(Boolean).join('+')
}

const KEY_ALIASES: Record<string, string> = {
  ' ': 'Space',
  space: 'Space',
  spacebar: 'Space',
  enter: 'Enter',
  return: 'Enter',
  esc: 'Escape',
  escape: 'Escape',
  del: 'Delete',
  delete: 'Delete',
  backspace: 'Backspace',
  tab: 'Tab',
  arrowup: 'Up',
  up: 'Up',
  arrowdown: 'Down',
  down: 'Down',
  arrowleft: 'Left',
  left: 'Left',
  arrowright: 'Right',
  right: 'Right',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  insert: 'Insert',
  plus: 'Plus'
}

function normalizeKey(raw: string): string {
  const lower = raw.toLowerCase()
  if (KEY_ALIASES[lower]) return KEY_ALIASES[lower]
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(raw)) return raw.toUpperCase()
  if (raw.length === 1) return raw.toLocaleUpperCase('en-US')
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export interface KeyLike {
  key: string
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

/**
 * Klavye olayından kısayol üretir. Harf ve rakamlarda fiziksel tuş (e.code) kullanılır,
 * böylece Türkçe klavyede "I/ı" gibi farklar veya Shift ile değişen karakterler sorun çıkarmaz.
 * Sadece değiştirici tuşa basıldıysa null döner.
 */
export function comboFromEvent(e: KeyLike): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'OS'].includes(e.key)) return null
  let key: string
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3)
  else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5)
  else if (/^Numpad[0-9]$/.test(e.code)) key = e.code.slice(6)
  else if (e.code === 'Space') key = 'Space'
  else key = normalizeKey(e.key)
  const mods = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Meta'].filter(Boolean)
  return [...mods, key].join('+')
}

export function matchesCombo(e: KeyLike, combo: string): boolean {
  return comboFromEvent(e) === normalizeCombo(combo)
}

const DISPLAY: Record<string, string> = {
  Control: 'Ctrl',
  Meta: 'Win',
  Space: 'Space',
  Delete: 'Del',
  Escape: 'Esc',
  Enter: 'Enter',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
  Plus: '+'
}

/** Kullanıcıya gösterim: "Control+Shift+K" → ["Ctrl", "Shift", "K"] */
export function comboParts(combo: string): string[] {
  return normalizeCombo(combo)
    .split('+')
    .filter(Boolean)
    .map((p) => DISPLAY[p] ?? p)
}

export function formatCombo(combo: string): string {
  return comboParts(combo).join(' + ')
}

/** Metin düzenlemede kullanılan, ezilmemesi gereken kısayollar */
const RESERVED = new Set(['Control+C', 'Control+V', 'Control+X', 'Control+A', 'Control+Z', 'Control+Y', 'Control+W', 'Control+Q', 'Alt+F4', 'Control+Shift+I'])
const NEVER = new Set(['Escape', 'Tab', 'Shift+Tab', 'Backspace'])

/** Kısayol bu eylem için uygun mu? Uygun değilse Türkçe neden döner. */
export function validateCombo(id: ActionId, combo: string): string | null {
  const action = ACTIONS.find((a) => a.id === id)
  if (!action) return 'Bilinmeyen eylem'
  const c = normalizeCombo(combo)
  const parts = c.split('+')
  const key = parts[parts.length - 1]
  const hasMod = parts.some((p) => p === 'Control' || p === 'Alt' || p === 'Meta')
  if (!key || (MODIFIERS as readonly string[]).includes(key)) return 'Bir tuş da seç (sadece Ctrl/Alt/Shift olmaz).'
  if (NEVER.has(c)) return `${formatCombo(c)} başka işler için gerekli, atanamaz.`
  if (RESERVED.has(c)) return `${formatCombo(c)} kopyala/yapıştır gibi temel bir kısayol, atanamaz.`
  if (action.scope === 'global' && !hasMod) return 'Her yerden çalışan kısayolda Ctrl, Alt veya Win de olmalı; yoksa yazı yazarken tetiklenir.'
  if (action.scope === 'app' && action.id !== 'newTask' && !hasMod) return 'Bu kısayolda Ctrl, Alt veya Win de olmalı.'
  return null
}

/**
 * Aynı kısayolu kullanan başka eylem. Kapsamlar iç içe çalıştığı için (global her yerde, uygulama kısayolu
 * görev seçiliyken de) aynı tuş iki eyleme verilemez.
 */
export function findConflict(bindings: Bindings, id: ActionId, combo: string): ActionId | null {
  const c = normalizeCombo(combo)
  return ACTIONS.find((a) => a.id !== id && normalizeCombo(bindings[a.id]) === c)?.id ?? null
}

export const actionLabel = (id: ActionId): string => ACTIONS.find((a) => a.id === id)?.label ?? id
