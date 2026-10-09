import * as React from 'react'
import { useLocation } from 'react-router-dom'
import { Timer, Archive, Bell, Repeat, Pause, Play, Trash2, Download, FolderOpen, Keyboard, Laptop, Monitor, Moon, RotateCcw, Sun, Upload, User, Clock3, Database, Mail, Flame, Cloud } from 'lucide-react'
import { toast } from 'sonner'
import type { BackupInfo, ThemeMode } from '../../../shared/types'
import { Page } from '@/components/common/Page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toggle } from '@/components/common/Toggle'
import { KeyCombo } from '@/components/common/KeyCombo'
import { KeybindingsEditor } from '@/components/settings/KeybindingsEditor'
import { ProfileSecurity } from '@/components/settings/ProfileSecurity'
import { MailAccounts } from '@/components/settings/MailAccounts'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApp } from '@/lib/app-context'
import { refreshAll, useData } from '@/lib/data'
import { formatMinutes } from '@/lib/format'
import { cn } from '@/lib/utils'


const TABS = [
  { id: 'general', label: 'Genel' },
  { id: 'planning', label: 'Planlama' },
  { id: 'advanced', label: 'Gelişmiş' }
] as const

type TabId = typeof TABS[number]['id']

function Card({ id, icon: Icon, title, description, children }: { id?: string; icon: React.ElementType; title: string; description: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section id={id} className="surface p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="size-4" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="text-[12.5px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

const THEMES: { id: ThemeMode; label: string; icon: React.ElementType; preview: string }[] = [
  { id: 'dark', label: 'Koyu', icon: Moon, preview: 'linear-gradient(135deg, oklch(0.17 0.03 272), oklch(0.25 0.06 270))' },
  { id: 'light', label: 'Açık', icon: Sun, preview: 'linear-gradient(135deg, oklch(0.98 0.008 265), oklch(0.92 0.03 262))' },
  { id: 'system', label: 'Sistem', icon: Monitor, preview: 'linear-gradient(135deg, oklch(0.98 0.008 265) 50%, oklch(0.17 0.03 272) 50%)' }
]

export function PageSettings(): React.JSX.Element {
  const { settings, updateSettings, bindings } = useApp()
  const [name, setName] = React.useState(settings.userName)
  const [tab, setTab] = React.useState<TabId>('general')
  React.useEffect(() => setName(settings.userName), [settings.userName])

  const save = async (patch: Parameters<typeof updateSettings>[0]): Promise<void> => {
    try {
      await updateSettings(patch)
      toast.success('Kaydedildi')
    } catch (e) {
      toast.error(e instanceof Error && e.message.includes('Gün bitişi') ? 'Gün bitişi başlangıçtan sonra olmalı.' : 'Kaydedilemedi.')
    }
  }

  const location = useLocation()
  // Başka ekrandan bir bölüme gelindiyse oraya kaydır ve doğru tab'ı aç
  React.useEffect(() => {
    const id = location.hash.replace('#', '')
    if (id === 'keys') setTab('advanced')
    else if (id === 'pomodoro') setTab('planning')
    
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 50)
  }, [location.hash])
  const pomo = settings.pomodoro
  const setPomo = (patch: Partial<typeof pomo>): Promise<void> => save({ pomodoro: { ...pomo, ...patch } })
  const recurrences = useData(() => window.api.recurrences.list()).data ?? []
  const ruleLabel = (r: (typeof recurrences)[number]): string => {
    const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
    const base =
      r.rule === 'daily' ? 'Her gün' : r.rule === 'weekdays' ? 'Hafta içi' : r.rule === 'weekly' ? r.weekdays.map((d) => days[d - 1]).join(', ') : `Her ayın ${r.dayOfMonth}. günü`
    return [base, r.time, r.estimateMin ? formatMinutes(r.estimateMin) : ''].filter(Boolean).join(' · ')
  }
  const recurrenceAction = async (fn: () => Promise<unknown>, msg: string): Promise<void> => {
    try {
      await fn()
      refreshAll()
      toast.success(msg)
    } catch {
      toast.error('İşlem başarısız.')
    }
  }
  const backupsData = useData(() => window.api.backups.list())
  const backups: BackupInfo[] = backupsData.data ?? []
  const reloadBackups = backupsData.reload
  const shortcutData = useData(() => window.api.shortcuts.status())
  const shortcut = shortcutData.data
  const reloadShortcut = shortcutData.reload
  const [confirm, setConfirm] = React.useState<{ kind: 'import' } | { kind: 'restore'; backup: BackupInfo } | null>(null)

  const runConfirmed = async (): Promise<void> => {
    if (!confirm) return
    try {
      if (confirm.kind === 'import') {
        const r = await window.api.data.importJson()
        setConfirm(null)
        if (!r) return
        toast.success('İçe aktarıldı', { description: `${r.tasks} görev yüklendi. Önceki veri yedeklendi.` })
      } else {
        await window.api.backups.restore(confirm.backup.path)
        setConfirm(null)
        toast.success('Yedeğe dönüldü', { description: 'Önceki veri ayrıca yedeklendi.' })
      }
      refreshAll()
      reloadBackups()
    } catch (e) {
      setConfirm(null)
      toast.error(e instanceof Error ? e.message.replace(/^.*Error: /, '') : 'İşlem başarısız.')
    }
  }

  return (
    <Page title="Ayarlar" subtitle="Uygulamayı kendine göre ayarla">
      <div className="mb-6 flex gap-2 border-b border-border/50 pb-px">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-[13.5px] font-medium transition-colors border-b-2 -mb-px',
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {tab === 'general' && (
          <>
            <Card icon={User} title="Profil" description="Selamlamada ve kenar çubuğunda görünür.">
              <div className="flex gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Adın" onKeyDown={(e) => e.key === 'Enter' && save({ userName: name.trim() })} />
                <Button onClick={() => save({ userName: name.trim() })} disabled={name.trim() === settings.userName}>
                  Kaydet
                </Button>
              </div>
            </Card>
            <Card icon={Sun} title="Görünüm" description="Tema anında değişir.">
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => save({ theme: t.id })}
                className={cn(
                  'rounded-xl border p-2 text-left transition-all',
                  settings.theme === t.id ? 'border-ring ring-2 ring-ring/30' : 'hover:border-ring/40'
                )}
              >
                <div className="h-14 rounded-lg border" style={{ background: t.preview }} />
                <div className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium">
                  <t.icon className="size-3.5" /> {t.label}
                </div>
              </button>
            ))}
          </div>
        </Card>
            <Card icon={Laptop} title="Masaüstü" description="Sistem tepsisi, Windows ile başlatma ve her yerden hızlı ekleme.">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13.5px] font-medium">Kapatınca tepsiye küçül</div>
                <div className="text-[12px] text-muted-foreground">Hatırlatmalar ve kısayol çalışmaya devam eder</div>
              </div>
              <Toggle label="Kapatınca tepsiye küçül" checked={settings.closeToTray} onChange={(v) => save({ closeToTray: v })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13.5px] font-medium">Windows açılınca başlat</div>
                <div className="text-[12px] text-muted-foreground">Tepside sessizce başlar (kurulu sürümde)</div>
              </div>
              <Toggle label="Windows açılınca başlat" checked={settings.launchAtLogin} onChange={(v) => save({ launchAtLogin: v })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13.5px] font-medium">Her yerden hızlı ekleme</div>
                <div className={cn('text-[12px]', shortcut?.error ? 'text-warning' : 'text-muted-foreground')}>
                  {shortcut?.error ?? 'Uygulama arka plandayken de çalışır'}
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg px-1.5 py-1 hover:bg-accent"
                title="Değiştir: Klavye kısayolları"
                onClick={() => setTab('advanced')}
              >
                <KeyCombo combo={shortcut?.quickAdd ?? bindings.quickAdd} size="md" />
              </button>
            </div>
          </div>
        </Card>
            <Card icon={Mail} title="E-Posta" description="Yıldızladığın (ya da seçtiğin) e-postalar Inbox'a görev olarak düşsün.">
              <MailAccounts />
            </Card>
          </>
        )}

        {tab === 'planning' && (
          <>
            <Card icon={Clock3} title="Gün" description="Planlayıcının saat aralığı ve günün bitişi.">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[12.5px] text-muted-foreground">
              Başlangıç
              <Input type="time" className="mt-1" value={settings.dayStart} onChange={(e) => e.target.value && save({ dayStart: e.target.value })} />
            </label>
            <label className="text-[12.5px] text-muted-foreground">
              Bitiş
              <Input type="time" className="mt-1" value={settings.dayEnd} onChange={(e) => e.target.value && save({ dayEnd: e.target.value })} />
            </label>
          </div>
        </Card>
            <div className="lg:col-span-2"><Card icon={Bell} title="Bildirimler" description="Saatli görevler ve derslerden önce masaüstüne hatırlatma gelir. Bildirime tıklayınca uygulama açılır.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                <div>
                  <div className="text-[13.5px] font-medium">Masaüstü bildirimleri</div>
                  <div className="text-[12px] text-muted-foreground">Görev, ders ve odak hatırlatmaları</div>
                </div>
                <Toggle label="Masaüstü bildirimleri" checked={settings.notifyEnabled} onChange={(v) => save({ notifyEnabled: v })} />
              </div>
              <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                <div>
                  <div className="text-[13.5px] font-medium">Gün başı özeti</div>
                  <div className="text-[12px] text-muted-foreground">{settings.dayStart}'de bugünün planı</div>
                </div>
                <Toggle label="Gün başı özeti" checked={settings.notifyMorning} onChange={(v) => save({ notifyMorning: v })} />
              </div>
              <div className="flex items-center justify-between rounded-xl border px-4 py-3 md:col-span-2">
                <div>
                  <div className="text-[13.5px] font-medium">Sabah planlama ve gün kapanışı</div>
                  <div className="text-[12px] text-muted-foreground">
                    Sabah kısa planlama daveti, gün bitişinden ({settings.dayEnd}) 30 dk önce gün kapanışı hatırlatması
                  </div>
                </div>
                <Toggle label="Sabah planlama ve gün kapanışı" checked={settings.ritualsEnabled} onChange={(v) => save({ ritualsEnabled: v })} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 md:col-span-2">
                <div>
                  <div className="text-[13.5px] font-medium">Bildirim Sesi</div>
                  <div className="text-[12px] text-muted-foreground">Masaüstü bildirimleri için çalınacak ses</div>
                </div>
                <div className="flex gap-1.5">
                  {[
                    { id: 'default', label: 'Varsayılan' },
                    { id: 'chime', label: 'Zil' },
                    { id: 'soft', label: 'Yumuşak' },
                    { id: 'none', label: 'Sessiz' }
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => save({ notifySound: s.id as any })}
                      className={cn(
                        'h-8 rounded-lg border px-3 text-[12.5px] font-medium transition-colors',
                        settings.notifySound === s.id ? 'border-ring/50 bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 md:col-span-2">
                <div>
                  <div className="text-[13.5px] font-medium">Ne kadar önce hatırlatsın?</div>
                  <div className="text-[12px] text-muted-foreground">Başlangıç anında da ayrıca bildirim gelir</div>
                </div>
                <div className="flex gap-1.5">
                  {[0, 5, 10, 15, 30, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => save({ notifyLeadMin: m })}
                      className={cn(
                        'h-8 rounded-lg border px-3 text-[12.5px] font-medium transition-colors',
                        settings.notifyLeadMin === m ? 'border-ring/50 bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {m === 0 ? 'Sadece başlarken' : `${m} dk`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              className="mt-4 gap-2"
              onClick={async () => {
                const ok = await window.api.notify.test().catch(() => false)
                if (ok) toast.success('Test bildirimi gönderildi', { description: 'Görmediysen Windows Ayarlar → Bildirimler kısmını kontrol et.' })
                else toast.error('Bu sistemde bildirimler desteklenmiyor.')
              }}
            >
              <Bell className="size-4" /> Test bildirimi gönder
            </Button>
          </Card></div>
            <div className="lg:col-span-2"></div>
            <div className="lg:col-span-2"><Card id="pomodoro" icon={Timer} title="Pomodoro" description="Focus ekranındaki Pomodoro modunun süreleri. Faz bitince masaüstü bildirimi gelir.">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(
                [
                  ['workMin', 'Odak', [15, 20, 25, 30, 45, 50, 60, 90]],
                  ['shortMin', 'Kısa mola', [3, 5, 10, 15]],
                  ['longMin', 'Uzun mola', [10, 15, 20, 30]],
                  ['cyclesBeforeLong', 'Uzun moladan önce tur', [2, 3, 4, 5, 6]]
                ] as const
              ).map(([key, label, options]) => (
                <label key={key} className="text-[12.5px] text-muted-foreground">
                  {label}
                  <select
                    value={pomo[key]}
                    onChange={(e) => setPomo({ [key]: Number(e.target.value) })}
                    className="mt-1 h-9 w-full rounded-lg border bg-background/50 px-2 text-[13px] text-foreground outline-none focus:border-ring/60"
                  >
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {key === 'cyclesBeforeLong' ? `${o} tur` : `${o} dk`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {(
                [
                  ['autoStartBreak', 'Mola kendiliğinden başlasın', 'Odak bitince'],
                  ['autoStartWork', 'Yeni tur kendiliğinden başlasın', 'Mola bitince']
                ] as const
              ).map(([key, label, hint]) => (
                <div key={key} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
                  <div>
                    <div className="text-[13px] font-medium">{label}</div>
                    <div className="text-[11.5px] text-muted-foreground">{hint}</div>
                  </div>
                  <Toggle label={label} checked={pomo[key]} onChange={(v) => setPomo({ [key]: v })} />
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium">Zil sesi</div>
                  <div className="text-[11.5px] text-muted-foreground">Faz değişince</div>
                </div>
                <Toggle label="Zil sesi" checked={settings.pomodoroSound} onChange={(v) => save({ pomodoroSound: v })} />
              </div>
            </div>
          </Card></div>
            <div className="lg:col-span-2"><Card icon={Repeat} title="Tekrarlayan görevler" description="Kurallar her gün için bugün ve yarının görevlerini otomatik oluşturur. Yeni kural: görev düzenleyicide Tekrar alanı.">
            {recurrences.length === 0 ? (
              <div className="text-[13px] text-muted-foreground">Henüz tekrar kuralı yok.</div>
            ) : (
              <div className="divide-y divide-border/60 rounded-xl border">
                {recurrences.map((r) => (
                  <div key={r.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5', !r.active && 'opacity-55')}>
                    <Repeat className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium">{r.title}</div>
                      <div className="text-[12px] text-muted-foreground">
                        {ruleLabel(r)}
                        {r.active ? '' : ' · durduruldu'}
                        {r.isHabit && ` · 🔥 ${r.currentStreak ?? 0} zincir (en uzun ${r.longestStreak ?? 0})`}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn('gap-1.5', r.isHabit && 'text-warning')}
                      title="Alışkanlık: her yapılışı kaydedilir, arka arkaya kaç kez yapıldığı (zincir) Bugün ekranında görünür"
                      aria-pressed={!!r.isHabit}
                      onClick={() =>
                        recurrenceAction(() => window.api.recurrences.update(r.id, { isHabit: !r.isHabit }), r.isHabit ? 'Alışkanlık takibi kapandı' : 'Alışkanlık olarak takip ediliyor')
                      }
                    >
                      <Flame className="size-3.5" /> {r.isHabit ? 'Alışkanlık' : 'Alışkanlık yap'}
                    </Button>
                    {r.active ? (
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => recurrenceAction(() => window.api.recurrences.stop(r.id), 'Kural durduruldu')}>
                        <Pause className="size-3.5" /> Durdur
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => recurrenceAction(() => window.api.recurrences.resume(r.id), 'Kural yeniden başladı')}>
                        <Play className="size-3.5" /> Devam
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Kuralı sil"
                      onClick={() => recurrenceAction(() => window.api.recurrences.delete(r.id), 'Kural silindi; oluşturulmuş görevler duruyor')}
                    >
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card></div>
          </>
        )}

        {tab === 'advanced' && (
          <>
            <div className="lg:col-span-2">
              <ProfileSecurity />
            </div>
            <div className="lg:col-span-2"><Card id="keys" icon={Keyboard} title="Klavye kısayolları" description="Her şey klavyeyle yapılabilir. İstediğin kısayolu tıklayıp yeni tuşlara basarak değiştir.">
            <KeybindingsEditor status={shortcut} onChanged={reloadShortcut} />
          </Card></div>
            <div className="lg:col-span-2"><Card icon={Database} title="Veri" description="Tüm veriler bu bilgisayarda, SQLite içinde saklanır. Her gün otomatik yedek alınır (son 7).">
              <DriveBackup />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={async () => {
                try {
                  const path = await window.api.data.exportJson()
                  if (path) toast.success('Dışa aktarıldı', { description: path })
                } catch {
                  toast.error('Dışa aktarılamadı.')
                }
              }}
            >
              <Download className="size-4" /> Dışa aktar (JSON)
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setConfirm({ kind: 'import' })}>
              <Upload className="size-4" /> İçe aktar (JSON)
            </Button>
          </div>
          <div className="mt-4 rounded-xl border">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
                <Archive className="size-3.5" /> Yedekler
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await window.api.backups.now()
                      reloadBackups()
                      toast.success('Yedek alındı')
                    } catch {
                      toast.error('Yedek alınamadı.')
                    }
                  }}
                >
                  Şimdi yedekle
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Yedek klasörünü aç" onClick={() => window.api.backups.openFolder()}>
                  <FolderOpen />
                </Button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {backups.length === 0 && <div className="px-3 py-2.5 text-[12px] text-muted-foreground">Henüz yedek yok. İlk otomatik yedek birkaç saniye içinde alınır.</div>}
              {backups.map((b) => (
                <div key={b.path} className="group flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-accent/40">
                  <span className="flex-1 truncate tabular">
                    {new Date(b.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {b.name.includes('oncesi') && <span className="ml-1.5 text-muted-foreground">(işlem öncesi)</span>}
                  </span>
                  <span className="tabular text-muted-foreground">{Math.max(1, Math.round(b.sizeBytes / 1024))} KB</span>
                  <button
                    type="button"
                    onClick={() => setConfirm({ kind: 'restore', backup: b })}
                    className="flex items-center gap-1 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <RotateCcw className="size-3" /> Geri dön
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Card></div>
          </>
        )}
      </div>
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm?.kind === 'import' ? 'JSON yedeğini içe aktar' : 'Bu yedeğe dön'}</DialogTitle>
            <DialogDescription>
              Mevcut tüm görevler, alanlar ve ayarlar seçtiğin yedektekilerle değiştirilecek. Güvenlik için önce şu anki verinin yedeği otomatik alınır.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={runConfirmed}>
              {confirm?.kind === 'import' ? 'Dosya seç ve içe aktar' : 'Yedeğe dön'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
function DriveBackup() {
  const [status, setStatus] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(false)

  const reload = () => {
    window.api.drive.status().then(setStatus)
  }

  React.useEffect(() => {
    reload()
  }, [])

  const handleConnect = async () => {
    setLoading(true)
    try {
      const ok = await window.api.drive.connect()
      if (ok) toast.success('Eşitleme klasörü ayarlandı')
    } catch {
      toast.error('Klasör seçilemedi')
    }
    setLoading(false)
    reload()
  }

  const handleDisconnect = async () => {
    await window.api.drive.disconnect()
    toast.success('Eşitleme bağlantısı kesildi')
    reload()
  }

  const handleBackup = async () => {
    setLoading(true)
    try {
      await window.api.drive.backupNow()
      toast.success('Yedek başarıyla alındı')
    } catch {
      toast.error('Yedek alınamadı')
    }
    setLoading(false)
    reload()
  }

  if (!status) return null

  return (
    <div className="mb-4 rounded-xl border px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[13.5px] font-medium text-brand">
          <Cloud className="size-4" /> Bulut / Yerel Eşitleme
        </div>
      </div>
      <div className="text-[12px] text-muted-foreground mb-4">
        Google Drive, OneDrive veya Dropbox klasörünüzü seçin. Uygulama buraya şifrelenmiş yedeklerini otomatik bırakır, bulut hizmetiniz de dosyayı eşitler. (API şifresi gerektirmez!)
        {status.connected && <div>Seçili Klasör: <span className="text-foreground break-all">{status.syncFolder}</span></div>}
        {status.connected && status.lastBackupAt && <div>Son eşitleme: {new Date(status.lastBackupAt).toLocaleString('tr-TR')}</div>}
      </div>
      
      <div className="flex gap-2">
        {!status.connected ? (
          <Button onClick={handleConnect} disabled={loading} size="sm">
            {loading ? 'Bağlanıyor...' : 'Google Drive\'a Bağlan'}
          </Button>
        ) : (
          <>
            <Button onClick={handleBackup} disabled={loading} size="sm" className="bg-brand hover:bg-brand/90 text-white">
              {loading ? 'Yedekleniyor...' : 'Şimdi Yedekle'}
            </Button>
            <Button onClick={handleDisconnect} variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
              Bağlantıyı Kes
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
