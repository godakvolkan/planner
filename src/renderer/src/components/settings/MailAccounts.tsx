import * as React from 'react'
import { AlertTriangle, ExternalLink, Loader2, Mail, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Toggle } from '@/components/common/Toggle'
import { useApp } from '@/lib/app-context'
import { refreshAll, useData } from '@/lib/data'
import { cn } from '@/lib/utils'
import { MAIL_PRESETS, RULE_LABEL, detectProvider, presetOf, type MailProvider, type MailRule } from '../../../../shared/mail'
import type { MailAccount } from '../../../../shared/types'

const input =
  'h-10 w-full rounded-lg border bg-background/50 px-3 text-[13.5px] outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20'
const clean = (e: unknown, fallback: string): string => (e instanceof Error ? e.message.replace(/^.*Error: /, '') : fallback)

function ago(iso: string | null): string {
  if (!iso) return 'henüz kontrol edilmedi'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'az önce kontrol edildi'
  if (min < 60) return `${min} dk önce kontrol edildi`
  const h = Math.round(min / 60)
  return h < 24 ? `${h} saat önce kontrol edildi` : new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) + ' kontrol edildi'
}

function RulePicker({ value, onChange }: { value: MailRule; onChange: (r: MailRule) => void }): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(RULE_LABEL) as MailRule[]).map((r) => (
        <button
          key={r}
          type="button"
          title={RULE_LABEL[r].hint}
          onClick={() => onChange(r)}
          className={cn(
            'rounded-lg border px-2.5 py-1 text-[12.5px] font-medium transition-colors',
            value === r ? 'border-primary/50 bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {r === 'flagged' ? '⭐ ' : r === 'unread' ? '✉️ ' : ''}
          {RULE_LABEL[r].label}
        </button>
      ))}
    </div>
  )
}

function AreaSelect({ value, onChange }: { value: number | null; onChange: (id: number | null) => void }): React.JSX.Element {
  const { areas } = useApp()
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="h-8 rounded-lg border bg-background/50 px-2 text-[12.5px] outline-none focus:border-ring/60"
      aria-label="Görevlerin düşeceği alan"
    >
      <option value="">Alansız</option>
      {areas.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  )
}

/** Ayarlar → E-posta: IMAP + uygulama şifresiyle hesap bağla, yeni e-postalar Inbox’a görev olarak düşsün */
export function MailAccounts(): React.JSX.Element {
  const accounts = useData(() => window.api.mail.list()).data ?? []
  const [adding, setAdding] = React.useState(false)
  const [busyId, setBusyId] = React.useState<number | null>(null)

  const update = async (a: MailAccount, patch: Parameters<typeof window.api.mail.update>[1]): Promise<void> => {
    try {
      await window.api.mail.update(a.id, patch)
      refreshAll()
    } catch (e) {
      toast.error(clean(e, 'Kaydedilemedi.'))
    }
  }

  const sync = async (a?: MailAccount): Promise<void> => {
    setBusyId(a?.id ?? -1)
    try {
      const r = await window.api.mail.sync(a?.id)
      refreshAll()
      if (r.errors.length) toast.error(r.errors[0])
      else toast.success(r.added ? `${r.added} e-posta Inbox’a eklendi` : 'Yeni e-posta yok')
    } catch (e) {
      toast.error(clean(e, 'Kontrol edilemedi.'))
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (a: MailAccount): Promise<void> => {
    try {
      await window.api.mail.remove(a.id)
      refreshAll()
      toast.success(`${a.email} bağlantısı kaldırıldı; oluşturulan görevler duruyor`)
    } catch (e) {
      toast.error(clean(e, 'Kaldırılamadı.'))
    }
  }

  return (
    <div className="space-y-3">
      {accounts.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          E-posta hesabını bağla; yıldızladığın (ya da seçtiğin) e-postalar Inbox’a görev olarak düşsün. Her 10 dakikada bir kontrol edilir, e-postaların hiçbir şekilde değiştirilmez.
        </p>
      ) : (
        <div className="divide-y divide-border/60 rounded-xl border">
          {accounts.map((a) => (
            <div key={a.id} className={cn('space-y-2.5 px-4 py-3', !a.enabled && 'opacity-60')}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <Mail className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium">{a.email}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {presetOf(a.provider).label} · {ago(a.lastSyncedAt)} · {a.imported} görev
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="gap-1.5" disabled={busyId !== null || !a.enabled} onClick={() => sync(a)}>
                  {busyId === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Şimdi kontrol et
                </Button>
                <Toggle checked={a.enabled} onChange={(v) => update(a, { enabled: v })} label={`${a.email} otomatik kontrol`} />
                <Button variant="ghost" size="icon-sm" aria-label="Bağlantıyı kaldır" onClick={() => remove(a)}>
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </div>
              {a.lastError && (
                <div className="flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {a.lastError}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-7">
                <RulePicker value={a.rule} onChange={(r) => update(a, { rule: r })} />
                <span className="text-[12px] text-muted-foreground">→ alan</span>
                <AreaSelect value={a.areaId} onChange={(id) => update(a, { areaId: id })} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="gap-2" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> E-posta hesabı bağla
        </Button>
        {accounts.length > 1 && (
          <Button variant="ghost" className="gap-2" disabled={busyId !== null} onClick={() => sync()}>
            {busyId === -1 ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Hepsini kontrol et
          </Button>
        )}
      </div>
      <ConnectDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function ConnectDialog({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element {
  const [email, setEmail] = React.useState('')
  const [provider, setProvider] = React.useState<MailProvider>('gmail')
  const [touchedProvider, setTouchedProvider] = React.useState(false)
  const [password, setPassword] = React.useState('')
  const [host, setHost] = React.useState('')
  const [port, setPort] = React.useState('993')
  const [rule, setRule] = React.useState<MailRule>('flagged')
  const [areaId, setAreaId] = React.useState<number | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const preset = presetOf(provider)

  React.useEffect(() => {
    if (!open) return
    setEmail('')
    setPassword('')
    setHost('')
    setPort('993')
    setRule('flagged')
    setAreaId(null)
    setError(null)
    setTouchedProvider(false)
    setProvider('gmail')
  }, [open])

  // Adres yazılınca sağlayıcıyı tahmin et (kullanıcı elle seçmediyse)
  React.useEffect(() => {
    if (!touchedProvider && email.includes('@')) setProvider(detectProvider(email))
  }, [email, touchedProvider])

  const connect = async (): Promise<void> => {
    setError(null)
    setBusy(true)
    try {
      const a = await window.api.mail.add({ provider, email, password, host: provider === 'custom' ? host : undefined, port: provider === 'custom' ? Number(port) : undefined, rule, areaId })
      refreshAll()
      toast.success(`${a.email} bağlandı`)
      onClose()
      // İlk kontrol hemen
      window.api.mail.sync(a.id).then((r) => {
        refreshAll()
        if (r.added) toast.success(`${r.added} e-posta Inbox’a eklendi`)
      }, () => undefined)
    } catch (e) {
      setError(clean(e, 'Bağlanılamadı.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>E-posta hesabı bağla</DialogTitle>
          <DialogDescription>Normal hesap şifren değil, sağlayıcının verdiği bir uygulama şifresi gerekir. Şifre bu bilgisayarda Windows şifrelemesiyle saklanır.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {MAIL_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProvider(p.id)
                  setTouchedProvider(true)
                }}
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors',
                  provider === p.id ? 'border-primary/50 bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <input className={input} type="email" autoFocus placeholder="E-posta adresin" value={email} onChange={(e) => setEmail(e.target.value)} />

          <div className="rounded-xl border bg-muted/30 p-3">
            <ol className="list-decimal space-y-1 pl-5 text-[12.5px] text-muted-foreground">
              {preset.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {preset.appPasswordUrl && (
              <a
                href={preset.appPasswordUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" /> {preset.label} uygulama şifresi sayfasını aç
              </a>
            )}
            {preset.warning && (
              <div className="mt-2 flex items-start gap-1.5 text-[12px] text-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {preset.warning}
              </div>
            )}
          </div>

          <input
            className={input}
            type="password"
            autoComplete="off"
            placeholder="Uygulama şifresi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && connect()}
          />

          {provider === 'custom' && (
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <input className={input} placeholder="IMAP sunucusu (örn. imap.ornek.com)" value={host} onChange={(e) => setHost(e.target.value)} />
              <input className={input} inputMode="numeric" placeholder="Port" value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))} />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="text-[12.5px] font-medium">Hangi e-postalar görev olsun?</div>
            <RulePicker value={rule} onChange={setRule} />
            <div className="text-[12px] text-muted-foreground">{RULE_LABEL[rule].hint}. İlk bağlantıda yalnızca son 7 gün alınır.</div>
          </div>
          <div className="flex items-center gap-2 text-[12.5px]">
            <span className="text-muted-foreground">Görevlerin düşeceği alan:</span>
            <AreaSelect value={areaId} onChange={setAreaId} />
          </div>

          {error && (
            <div className="flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive" role="alert">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Vazgeç
          </Button>
          <Button className="gap-2 border-0 bg-brand font-semibold text-white" disabled={busy || !email.trim() || !password.trim()} onClick={connect}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} {busy ? 'Bağlantı deneniyor…' : 'Bağlan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
