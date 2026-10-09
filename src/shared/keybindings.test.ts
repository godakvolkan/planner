import { describe, expect, it } from 'vitest'
import {
  comboFromEvent,
  defaultBindings,
  findConflict,
  formatCombo,
  matchesCombo,
  normalizeCombo,
  resolveBindings,
  validateCombo,
  type KeyLike
} from './keybindings'

const ev = (over: Partial<KeyLike>): KeyLike => ({ key: 'k', code: 'KeyK', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...over })

describe('normalizeCombo', () => {
  it('değiştirici sırası ve takma adlar', () => {
    expect(normalizeCombo('shift+ctrl+k')).toBe('Control+Shift+K')
    expect(normalizeCombo('Ctrl+Space')).toBe('Control+Space')
    expect(normalizeCombo('del')).toBe('Delete')
    expect(normalizeCombo('ctrl+,')).toBe('Control+,')
    expect(normalizeCombo('alt+f4')).toBe('Alt+F4')
  })
})

describe('comboFromEvent', () => {
  it('harflerde fiziksel tuş: Türkçe klavyede ı/İ fark etmez', () => {
    expect(comboFromEvent(ev({ key: 'ı', code: 'KeyI' }))).toBe('I')
    expect(comboFromEvent(ev({ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true }))).toBe('Control+Shift+K')
  })
  it('rakam, boşluk, özel tuşlar', () => {
    expect(comboFromEvent(ev({ key: '^', code: 'Digit3', shiftKey: true }))).toBe('Shift+3')
    expect(comboFromEvent(ev({ key: ' ', code: 'Space', ctrlKey: true }))).toBe('Control+Space')
    expect(comboFromEvent(ev({ key: 'Delete', code: 'Delete' }))).toBe('Delete')
    expect(comboFromEvent(ev({ key: ',', code: 'Backslash', ctrlKey: true }))).toBe('Control+,')
  })
  it('sadece değiştiriciye basılınca null', () => {
    expect(comboFromEvent(ev({ key: 'Control', code: 'ControlLeft', ctrlKey: true }))).toBeNull()
  })
  it('eşleşme', () => {
    expect(matchesCombo(ev({ ctrlKey: true }), 'ctrl+k')).toBe(true)
    expect(matchesCombo(ev({ ctrlKey: true, shiftKey: true }), 'Control+K')).toBe(false)
  })
})

describe('resolveBindings', () => {
  it('kayıtlı değişiklikler varsayılanların üstüne uygulanır, bozuklar atlanır', () => {
    const b = resolveBindings({ palette: 'ctrl+p', taskComplete: '', unknown: 'Q' })
    expect(b.palette).toBe('Control+P')
    expect(b.taskComplete).toBe('X')
    expect(b.quickAdd).toBe('Control+Space')
  })
})

describe('validateCombo', () => {
  it('global kısayolda değiştirici şart', () => {
    expect(validateCombo('quickAdd', 'Q')).toMatch(/Ctrl, Alt/)
    expect(validateCombo('quickAdd', 'Alt+Space')).toBeNull()
  })
  it('kopyala/yapıştır ve Esc atanamaz', () => {
    expect(validateCombo('palette', 'Control+C')).toMatch(/temel/)
    expect(validateCombo('taskComplete', 'Escape')).toMatch(/atanamaz/)
  })
  it('görev kısayolu tek tuş olabilir; sadece değiştirici olamaz', () => {
    expect(validateCombo('taskComplete', 'D')).toBeNull()
    expect(validateCombo('taskComplete', 'Shift')).toMatch(/Bir tuş/)
  })
})

describe('findConflict', () => {
  const b = defaultBindings()
  it('aynı kapsamda çakışma', () => {
    expect(findConflict(b, 'taskComplete', 'F')).toBe('taskFocus')
    expect(findConflict(b, 'navNow', 'ctrl+2')).toBe('navToday')
  })
  it('global her şeyle çakışır', () => {
    expect(findConflict(b, 'palette', 'Control+Space')).toBe('quickAdd')
  })
  it('uygulama tek tuşu (N) görev tuşuyla çakışır', () => {
    expect(findConflict(b, 'taskComplete', 'N')).toBe('newTask')
  })
  it('çakışma yoksa null', () => {
    expect(findConflict(b, 'taskComplete', 'D')).toBeNull()
  })
})

describe('formatCombo', () => {
  it('okunur gösterim', () => {
    expect(formatCombo('Control+Shift+Space')).toBe('Ctrl + Shift + Space')
    expect(formatCombo('Delete')).toBe('Del')
  })
})
