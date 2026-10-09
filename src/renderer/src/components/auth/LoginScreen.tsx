import * as React from 'react'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound, Zap } from 'lucide-react'
import logo from '@/assets/logo.png'
import type { ProfileInfo } from '../../../../shared/types'
import './login.css'

const MIN_PASSWORD = 4
// "Beni hatırla": yalnızca e-posta saklanır, şifre asla
const REMEMBER_KEY = 'cc:login:remember'
const LAST_KEY = 'cc:login:last'

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase('tr-TR'))
    .join('')

/** Profil rozeti (Ayarlar → Profil ve güvenlik de kullanır) */
export function Avatar({ profile, size = 48 }: { profile: Pick<ProfileInfo, 'name' | 'color'>; size?: number }): React.JSX.Element {
  const color = `var(--${profile.color})`
  return (
    <span
      className="grid shrink-0 place-items-center rounded-2xl font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, ${color}, color-mix(in oklch, ${color} 60%, var(--brand-violet)))` }}
    >
      {initials(profile.name) || <UserRound className="size-1/2" />}
    </span>
  )
}

const errText = (e: unknown, fallback: string): string => (e instanceof Error ? e.message.replace(/^.*Error: /, '') : fallback)

function readRemember(): { remember: boolean; last: string } {
  try {
    return { remember: localStorage.getItem(REMEMBER_KEY) !== '0', last: localStorage.getItem(LAST_KEY) ?? '' }
  } catch {
    return { remember: true, last: '' }
  }
}

function saveRemember(remember: boolean, identifier: string): void {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
    if (remember) localStorage.setItem(LAST_KEY, identifier.trim())
    else localStorage.removeItem(LAST_KEY)
  } catch {
    // saklanamazsa bir dahaki açılışta boş gelir
  }
}

function GoogleIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

function Field({
  label,
  icon: Icon,
  children,
  locked
}: {
  label: string
  icon: React.ElementType
  children: React.ReactNode
  locked?: boolean
}): React.JSX.Element {
  return (
    <div className="field">
      <label className="field-label">
        {label}
        <div className={locked ? 'input-wrap locked' : 'input-wrap'} style={{ marginTop: 10 }}>
          <Icon size={19} className="input-icon" />
          {children}
        </div>
      </label>
    </div>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
  autoComplete = 'current-password',
  children
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoFocus?: boolean
  autoComplete?: string
  children?: React.ReactNode
}): React.JSX.Element {
  const [show, setShow] = React.useState(false)
  const [caps, setCaps] = React.useState(false)
  return (
    <div className="field">
      <label className="field-label">
        {label}
        <div className="input-wrap" style={{ marginTop: 10 }}>
          <LockKeyhole size={19} className="input-icon" />
          <input
            type={show ? 'text' : 'password'}
            value={value}
            autoFocus={autoFocus}
            autoComplete={autoComplete}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => setCaps(e.getModifierState('CapsLock'))}
            onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))}
          />
          <button type="button" className="visibility-button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}>
            {show ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
      </label>
      {caps && <div className="field-note">Caps Lock açık</div>}
      {children}
    </div>
  )
}

function SubmitButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }): React.JSX.Element {
  return (
    <button className="submit-button" type="submit" disabled={busy}>
      <span>{busy ? busyLabel : label}</span>
      {!busy && <ArrowRight size={20} />}
      <span className="button-shine" />
    </button>
  )
}

type View = { kind: 'signin' } | { kind: 'create'; google?: { email: string; name: string | null } }

/** Giriş ekranı: e-posta + şifre ya da Google. Profil yoksa "ilk profilini oluştur". */
export function LoginScreen({ onLoggedIn }: { onLoggedIn: (p: ProfileInfo) => void }): React.JSX.Element {
  const [profiles, setProfiles] = React.useState<ProfileInfo[] | null>(null)
  const [legacy, setLegacy] = React.useState(false)
  const [google, setGoogle] = React.useState<{ available: boolean; configPath: string }>({ available: false, configPath: '' })
  const [view, setView] = React.useState<View>({ kind: 'signin' })
  const [shake, setShake] = React.useState(false)

  const reload = React.useCallback(async () => {
    const [list, hasLegacy, g] = await Promise.all([window.api.auth.profiles(), window.api.auth.hasLegacyData(), window.api.auth.googleSetup()])
    setProfiles(list)
    setLegacy(hasLegacy)
    setGoogle(g)
    if (list.length === 0) setView((v) => (v.kind === 'create' ? v : { kind: 'create' }))
  }, [])

  React.useEffect(() => {

    reload().catch(() => setProfiles([]))
    // Profil silinince / eklenince listeyi tazele
    return window.api.onAuthChanged(() => void reload().catch(() => setProfiles([])))
  }, [reload])

  const bump = (): void => {
    setShake(true)
    setTimeout(() => setShake(false), 450)
  }

  const first = profiles !== null && profiles.length === 0

  return (
    <main className="cc-login">
      <div className="drag drag-strip" />
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="brand-panel">
        <div className="brand">
          <img src={logo} alt="" draggable={false} />
          <span>
            Control <b>Center</b>
          </span>
        </div>

        <div className="brand-content">
          <div className="hero-logo">
            <img src={logo} alt="" draggable={false} />
            <span className="logo-glow" />
          </div>
          <div className="eyebrow">
            <span className="status-dot" />
            HER ŞEY KONTROL ALTINDA
          </div>
          <h1>
            Tek bir panelden
            <br />
            tüm <span className="gradient-text">kontrol</span> sende.
          </h1>
          <p className="brand-description">Görevlerini, ders programını ve odak zamanını tek yerden yönet. Aklında tutma; planına bırak, şimdi ne yapacağını o söylesin.</p>
          <div className="feature-list">
            <div className="feature">
              <span className="feature-icon">
                <Zap size={19} />
              </span>
              <span>
                <b>Hızlı ekleme</b>
                <small>Her yerden tek kısayol</small>
              </span>
            </div>
            <div className="feature">
              <span className="feature-icon">
                <ShieldCheck size={19} />
              </span>
              <span>
                <b>Ayrı profiller</b>
                <small>Veriler bu bilgisayarda</small>
              </span>
            </div>
            <div className="feature">
              <span className="feature-icon">
                <Sparkles size={19} />
              </span>
              <span>
                <b>Odak ve plan</b>
                <small>Şimdi ne yapmalıyım?</small>
              </span>
            </div>
          </div>
        </div>

        <div className="brand-footer">
          <span>CONTROL CENTER</span>
          <span className="footer-status">
            <span /> Sistem hazır
          </span>
        </div>
      </section>

      <section className="form-panel">
        <div className={shake ? 'login-card shake' : 'login-card'}>
          <div className="card-decoration" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </div>

          {profiles === null ? (
            <div style={{ height: 380 }} />
          ) : view.kind === 'signin' && !first ? (
            <SignIn
              profiles={profiles}
              google={google}
              onFail={bump}
              onLoggedIn={onLoggedIn}
              onCreate={(google) => setView({ kind: 'create', google })}
            />
          ) : (
            <CreateProfile
              first={first}
              legacy={legacy}
              google={view.kind === 'create' ? view.google : undefined}
              googleSetup={google}
              onFail={bump}
              onBack={first ? undefined : () => setView({ kind: 'signin' })}
              onGoogle={(google) => setView({ kind: 'create', google })}
              onLoggedIn={onLoggedIn}
            />
          )}

          <div className="security-note">
            <ShieldCheck size={17} />
            <span>Her profilin verisi ayrı ve bu bilgisayarda saklanır; şifreler yalnızca özet olarak tutulur.</span>
          </div>
        </div>

        <div className="mobile-footer">
          <LockKeyhole size={13} /> Güvenli oturum · Control Center
        </div>
      </section>
    </main>
  )
}

/** Google düğmesi + "veya" ayracı. İstemci kimliği tanımlı değilse nasıl kurulacağını anlatır. */
function GoogleButton({
  setup,
  label,
  onResult,
  onMessage
}: {
  setup: { available: boolean; configPath: string }
  label: string
  onResult: (r: Awaited<ReturnType<typeof window.api.auth.google>>) => void
  onMessage: (m: { kind: 'error' | 'info'; text: React.ReactNode }) => void
}): React.JSX.Element {
  const [busy, setBusy] = React.useState(false)
  const click = async (): Promise<void> => {
    if (!setup.available) {
      onMessage({
        kind: 'info',
        text: (
          <>
            Google ile giriş henüz kurulmadı. Google Cloud'da <b>Masaüstü uygulaması</b> türünde bir OAuth istemcisi oluştur, indirdiğin JSON dosyasını şuraya koy:
            <br />
            <b style={{ wordBreak: 'break-all' }}>{setup.configPath}</b>
            <br />
            Dosya bulununca düğme kendiliğinden çalışır. O zamana kadar e-posta ve şifreyle gir.
          </>
        )
      })
      return
    }
    setBusy(true)
    onMessage({ kind: 'info', text: 'Tarayıcıda Google hesabını seç; bitince buraya dönülür.' })
    try {
      onResult(await window.api.auth.google())
    } catch (e) {
      onMessage({ kind: 'error', text: errText(e, 'Google girişi başarısız.') })
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="divider">
        <span />
        <small>veya</small>
        <span />
      </div>
      <button className="secondary-button" type="button" onClick={click} disabled={busy}>
        <GoogleIcon />
        <span>{busy ? 'Google bekleniyor…' : label}</span>
      </button>
    </>
  )
}

function SignIn({
  profiles,
  google,
  onFail,
  onLoggedIn,
  onCreate
}: {
  profiles: ProfileInfo[]
  google: { available: boolean; configPath: string }
  onFail: () => void
  onLoggedIn: (p: ProfileInfo) => void
  onCreate: (google?: { email: string; name: string | null }) => void
}): React.JSX.Element {
  const saved = React.useMemo(readRemember, [])
  // Hatırlanan e-posta; yoksa tek profil varsa onun e-postası (ya da adı)
  const [identifier, setIdentifier] = React.useState(() => saved.last || (profiles.length === 1 ? (profiles[0].email ?? profiles[0].name) : ''))
  const [password, setPassword] = React.useState('')
  const [remember, setRemember] = React.useState(saved.remember)
  const [busy, setBusy] = React.useState(false)
  const [wait, setWait] = React.useState(0)
  const [failed, setFailed] = React.useState(0)
  const [hintShown, setHintShown] = React.useState(false)
  const [message, setMessage] = React.useState<{ kind: 'error' | 'info'; text: React.ReactNode } | null>(null)
  const legacyNames = profiles.some((p) => !p.email)

  // Profil silinip tek profil kalırsa boş e-posta kutusu onunla dolsun
  const only = profiles.length === 1 ? (profiles[0].email ?? profiles[0].name) : null
  React.useEffect(() => {
    if (only) setIdentifier((v) => v || only)
  }, [only])

  React.useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setMessage(null)
    if (!identifier.trim() || !password) {
      setMessage({ kind: 'error', text: 'E-posta ve şifre alanları zorunludur.' })
      onFail()
      return
    }
    if (busy || wait > 0) return
    setBusy(true)
    try {
      const r = await window.api.auth.loginEmail(identifier, password)
      if (r.ok && r.profile) {
        saveRemember(remember, identifier)
        return onLoggedIn(r.profile)
      }
      setWait(r.retryInSec ?? 0)
      setFailed((f) => f + 1)
      setPassword('')
      setMessage({ kind: 'error', text: r.error ?? 'Giriş yapılamadı.' })
      onFail()
    } finally {
      setBusy(false)
    }
  }

  const forgot = async (): Promise<void> => {
    setHintShown(true)
    const hint = identifier.trim() ? await window.api.auth.hint(identifier) : null
    setMessage({
      kind: 'info',
      text: (
        <>
          {hint ? (
            <>
              <b>İpucu:</b> {hint}
              <br />
            </>
          ) : identifier.trim() ? (
            <>
              Bu profil için ipucu yok.
              <br />
            </>
          ) : null}
          Şifreler yalnızca bu bilgisayarda saklanır, bu yüzden e-postayla sıfırlanamaz. Profilinin e-postası Google hesabınla aynıysa <b>Google ile giriş</b> yapıp Ayarlar →
          Profil ve güvenlik'ten yeni şifre belirleyebilirsin.
        </>
      )
    })
  }

  return (
    <>
      <div className="welcome-label">
        Tekrar hoş geldin <span>✦</span>
      </div>
      <h2>Hesabına giriş yap</h2>
      <p className="form-description">Devam etmek için bilgilerini gir.</p>

      <form onSubmit={submit} noValidate>
        <Field label="E-posta" icon={Mail}>
          <input
            type="email"
            autoComplete="username"
            placeholder={legacyNames ? 'E-posta adresin (ya da profil adın)' : 'E-posta adresin'}
            value={identifier}
            autoFocus={!identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </Field>
        <PasswordField label="Şifre" value={password} onChange={setPassword} placeholder="Şifreni gir" autoFocus={!!identifier} />

        <div className="form-options">
          <label className="remember-option">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span className="custom-checkbox">
              <Check size={13} />
            </span>
            Beni hatırla
          </label>
          <button type="button" className="text-link" onClick={forgot}>
            Şifremi unuttum?
          </button>
        </div>

        {message && (
          <div className={`message ${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>
            {message.text}
            {message.kind === 'error' && wait > 0 && <> · {wait} sn sonra tekrar dene</>}
          </div>
        )}
        {failed >= 2 && !hintShown && (
          <div className="message info">
            Hatırlamıyor musun?{' '}
            <button type="button" className="text-link" onClick={forgot}>
              İpucunu göster
            </button>
          </div>
        )}

        <SubmitButton busy={busy || wait > 0} label="Giriş Yap" busyLabel={wait > 0 ? `${wait} sn bekle` : 'Kontrol ediliyor…'} />
      </form>

      <GoogleButton
        setup={google}
        label="Google ile devam et"
        onMessage={setMessage}
        onResult={(r) => {
          if (r.ok && r.profile) return onLoggedIn(r.profile)
          if (r.google) return onCreate(r.google)
          setMessage({ kind: 'error', text: r.error ?? 'Google girişi başarısız.' })
        }}
      />

      <div className="switch-line">
        Profilin yok mu?
        <button type="button" className="text-link" onClick={() => onCreate()}>
          Profil oluştur
        </button>
      </div>
    </>
  )
}

function CreateProfile({
  first,
  legacy,
  google,
  googleSetup,
  onFail,
  onBack,
  onGoogle,
  onLoggedIn
}: {
  first: boolean
  legacy: boolean
  google?: { email: string; name: string | null }
  googleSetup: { available: boolean; configPath: string }
  onFail: () => void
  onBack?: () => void
  onGoogle: (google: { email: string; name: string | null }) => void
  onLoggedIn: (p: ProfileInfo) => void
}): React.JSX.Element {
  const [name, setName] = React.useState(google?.name ?? '')
  const [email, setEmail] = React.useState(google?.email ?? '')
  const [password, setPassword] = React.useState('')
  const [repeat, setRepeat] = React.useState('')
  const [hint, setHint] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<{ kind: 'error' | 'info'; text: React.ReactNode } | null>(null)

  // Google'dan gelince alanları doldur
  React.useEffect(() => {
    if (!google) return
    setEmail(google.email)
    if (google.name) setName((n) => n || google.name!)
  }, [google])

  const strength = password.length === 0 ? 0 : password.length < MIN_PASSWORD ? 1 : password.length < 8 ? 2 : /[^a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(password) ? 4 : 3
  const strengthLabel = ['', 'Çok kısa', 'Zayıf', 'İyi', 'Güçlü'][strength]

  const fail = (text: string): void => {
    setMessage({ kind: 'error', text })
    onFail()
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setMessage(null)
    if (!name.trim()) return fail('Adını yaz.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return fail('Geçerli bir e-posta adresi yaz.')
    if (password.length < MIN_PASSWORD) return fail(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`)
    if (password !== repeat) return fail('Şifreler aynı değil.')
    setBusy(true)
    try {
      const p = await window.api.auth.create({ name: name.trim(), email: email.trim(), password, hint: hint.trim() || null })
      const r = await window.api.auth.login(p.id, password)
      if (r.ok && r.profile) {
        saveRemember(true, email)
        onLoggedIn(r.profile)
      } else fail(r.error ?? 'Giriş yapılamadı.')
    } catch (err) {
      fail(errText(err, 'Profil oluşturulamadı.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {onBack && (
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={14} /> Girişe dön
        </button>
      )}
      <div className="welcome-label">
        {first ? 'Hoş geldin' : 'Yeni profil'} <span>✦</span>
      </div>
      <h2>{first ? 'İlk profilini oluştur' : 'Profil oluştur'}</h2>
      <p className="form-description">
        {google
          ? 'Google hesabın doğrulandı. Bu profil için bir şifre belirle; sonra ister şifreyle ister Google ile girersin.'
          : first && legacy
            ? 'Mevcut görevlerin, ders programın ve ayarların bu profile taşınacak.'
            : 'Bu profilin görevleri ve planı diğer profillerden tamamen ayrı tutulur.'}
      </p>

      <form onSubmit={submit} noValidate>
        <Field label="Adın" icon={UserRound}>
          <input autoFocus={!google} maxLength={40} placeholder="Adın" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="E-posta" icon={Mail} locked={!!google}>
          <input type="email" autoComplete="username" placeholder="E-posta adresin" value={email} readOnly={!!google} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <PasswordField label="Şifre" value={password} onChange={setPassword} placeholder={`En az ${MIN_PASSWORD} karakter`} autoComplete="new-password" autoFocus={!!google}>
          {password && (
            <div className="strength">
              {[1, 2, 3, 4].map((i) => (
                <i key={i} className={i <= strength ? `on-${strength}` : undefined} />
              ))}
              <small>{strengthLabel}</small>
            </div>
          )}
        </PasswordField>
        <PasswordField label="Şifre tekrar" value={repeat} onChange={setRepeat} placeholder="Şifreni tekrar gir" autoComplete="new-password" />
        <Field label="Şifre ipucu (isteğe bağlı)" icon={Sparkles}>
          <input maxLength={80} placeholder="Şifrenin kendisini yazma" value={hint} onChange={(e) => setHint(e.target.value)} />
        </Field>

        <div style={{ height: 24 }} />
        {message && (
          <div className={`message ${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>
            {message.text}
          </div>
        )}
        <SubmitButton busy={busy} label={first ? 'Profili oluştur ve gir' : 'Oluştur ve gir'} busyLabel="Oluşturuluyor…" />
      </form>

      {!google && (
        <GoogleButton
          setup={googleSetup}
          label="Google ile doldur"
          onMessage={setMessage}
          onResult={(r) => {
            if (r.ok && r.profile) return onLoggedIn(r.profile)
            if (r.google) return onGoogle(r.google)
            setMessage({ kind: 'error', text: r.error ?? 'Google girişi başarısız.' })
          }}
        />
      )}
      <div className="switch-line" style={{ fontSize: 11.5 }}>
        Şifre unutulursa geri getirilemez; veriler bu bilgisayarda kalır.
      </div>
    </>
  )
}
