import * as React from 'react'
import { KeyRound, Lock, Mail, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar } from '@/components/auth/LoginScreen'
import { useApp } from '@/lib/app-context'
import { refreshAll } from '@/lib/data'
import { formatCombo } from '../../../../shared/keybindings'

const input =
  'h-10 w-full rounded-lg border bg-background/50 px-3 text-[13.5px] outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20'
const clean = (e: unknown, fallback: string): string => (e instanceof Error ? e.message.replace(/^.*Error: /, '') : fallback)

/** Ayarlar → Profil ve güvenlik: ad, şifre değiştir, kilitle, profili sil */
export function ProfileSecurity(): React.JSX.Element | null {
  const { profile, lock, bindings } = useApp()
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [pw, setPw] = React.useState({ old: '', next: '', repeat: '', hint: '' })
  const [deleting, setDeleting] = React.useState(false)
  const [deletePw, setDeletePw] = React.useState('')
  React.useEffect(() => setName(profile?.name ?? ''), [profile?.name])
  React.useEffect(() => setEmail(profile?.email ?? ''), [profile?.email])
  // Google ile girildiyse (şifre unutulduysa) eski şifre sorulmaz
  const viaGoogle = !!profile?.viaGoogle
  if (!profile) return null

  const rename = async (): Promise<void> => {
    try {
      await window.api.auth.rename(name)
      refreshAll()
      toast.success('Profil adı değişti')
    } catch (e) {
      toast.error(clean(e, 'Kaydedilemedi.'))
    }
  }

  const saveEmail = async (): Promise<void> => {
    try {
      await window.api.auth.setEmail(email)
      refreshAll()
      toast.success('Giriş e-postası kaydedildi')
    } catch (e) {
      toast.error(clean(e, 'Kaydedilemedi.'))
    }
  }

  const changePassword = async (): Promise<void> => {
    if (pw.next !== pw.repeat) return void toast.error('Yeni şifreler aynı değil.')
    try {
      await window.api.auth.changePassword(pw.old, pw.next, pw.hint.trim() ? pw.hint : undefined)
      setPw({ old: '', next: '', repeat: '', hint: '' })
      toast.success('Şifre değişti')
    } catch (e) {
      toast.error(clean(e, 'Şifre değiştirilemedi.'))
    }
  }

  const remove = async (): Promise<void> => {
    try {
      await window.api.auth.delete(profile.id, deletePw)
      // Açık profil silinince giriş ekranına dönülür (auth:changed)
    } catch (e) {
      toast.error(clean(e, 'Silinemedi.'))
    }
  }

  return (
    <section className="surface p-6 max-sm:p-4">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar profile={profile} size={44} />
        <div className="min-w-[180px] flex-1">
          <h2 className="text-[15px] font-semibold">Profil ve güvenlik</h2>
          <p className="text-[12.5px] text-muted-foreground">
            Bu profilin görevleri, ders programı, ayarları ve yedekleri diğer profillerden ayrı tutulur.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => lock()}>
          <Lock className="size-4" /> Kilitle <span className="text-[11px] text-muted-foreground">{formatCombo(bindings.lock)}</span>
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium">
            <UserRound className="size-3.5 text-primary" /> Profil adı
          </div>
          <div className="flex gap-2">
            <input className={input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rename()} />
            <Button variant="outline" disabled={!name.trim() || name.trim() === profile.name} onClick={rename}>
              Kaydet
            </Button>
          </div>
          <div className="mb-1.5 mt-5 flex items-center gap-1.5 text-[13px] font-medium">
            <Mail className="size-3.5 text-primary" /> Giriş e-postası
          </div>
          <div className="flex gap-2">
            <input
              className={input}
              type="email"
              value={email}
              maxLength={120}
              placeholder="ornek@mail.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveEmail()}
            />
            <Button variant="outline" disabled={!email.trim() || email.trim().toLowerCase() === (profile.email ?? '')} onClick={saveEmail}>
              Kaydet
            </Button>
          </div>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {profile.email ? 'Google hesabın bu adresle aynıysa Google ile de girebilirsin.' : 'Henüz e-posta yok; şimdilik profil adınla giriyorsun.'}
          </p>
          <div className="mt-6 flex items-center gap-1.5 text-[13px] font-medium text-destructive">
            <Trash2 className="size-3.5" /> Profili sil
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">Tüm görevler, ders programı ve yedekler kalıcı olarak silinir.</p>
          <Button variant="outline" className="mt-2 gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleting(true)}>
            <Trash2 className="size-4" /> Bu profili sil…
          </Button>
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium">
            <KeyRound className="size-3.5 text-primary" /> Şifre değiştir
          </div>
          <div className="space-y-2">
            {viaGoogle ? (
              <p className="rounded-lg bg-muted/60 px-3 py-2 text-[12px] text-muted-foreground">Google ile giriş yaptın; mevcut şifreyi bilmeden yenisini belirleyebilirsin.</p>
            ) : (
              <input className={input} type="password" placeholder="Mevcut şifre" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} />
            )}
            <input className={input} type="password" placeholder="Yeni şifre (en az 4 karakter)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <input
              className={input}
              type="password"
              placeholder="Yeni şifre tekrar"
              value={pw.repeat}
              onChange={(e) => setPw({ ...pw, repeat: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && changePassword()}
            />
            <input className={input} placeholder="Yeni ipucu (isteğe bağlı)" maxLength={80} value={pw.hint} onChange={(e) => setPw({ ...pw, hint: e.target.value })} />
            <Button className="gap-2 border-0 bg-brand font-semibold text-white" disabled={(!viaGoogle && !pw.old) || !pw.next} onClick={changePassword}>
              <ShieldCheck className="size-4" /> Şifreyi değiştir
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={deleting} onOpenChange={(o) => { setDeleting(o); if (!o) setDeletePw('') }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">"{profile.name}" profilini sil</DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. Bu profilin tüm görevleri, ders programı, ayarları ve otomatik yedekleri silinir. Onaylamak için şifreni gir.
            </DialogDescription>
          </DialogHeader>
          <input autoFocus className={input} type="password" placeholder="Şifre" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && deletePw && remove()} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              Vazgeç
            </Button>
            <Button variant="destructive" disabled={!deletePw} onClick={remove}>
              Kalıcı olarak sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
