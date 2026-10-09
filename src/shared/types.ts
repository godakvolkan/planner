// Main, preload ve renderer arasındaki ortak sözleşme.
// Bu dosyayı sadece backend tarafı (src/main, src/preload, src/shared) değiştirir.
// Tarihler yerel saatle 'YYYY-MM-DD', saatler 'HH:mm' formatındadır.

export interface Area {
  id: number
  name: string
  icon: string
  color: string
  sort_order: number
}

export interface AreaInput {
  name: string
  icon?: string
  /** 'area-1' … 'area-8' */
  color?: string
}

/** Ders programı / haftalık sabit etkinlik */
export interface FixedEvent {
  id: number
  title: string
  areaId: number | null
  /** 1 = Pazartesi … 7 = Pazar */
  weekday: number
  startTime: string
  endTime: string
  location: string | null
  /** Dönem başı / sonu (dahil). Boşsa her hafta geçerli. */
  validFrom: string | null
  validTo: string | null
  countsAgainstCapacity: boolean
}

export interface FixedEventInput {
  title: string
  areaId?: number | null
  weekday: number
  startTime: string
  endTime: string
  location?: string | null
  validFrom?: string | null
  validTo?: string | null
  countsAgainstCapacity?: boolean
}

export type TaskStatus = 'inbox' | 'planned' | 'active' | 'waiting' | 'done' | 'archived'

/** 1 = düşük, 2 = orta, 3 = yüksek, 4 = acil */
export type Priority = 1 | 2 | 3 | 4

export type FirstStepType = 'file' | 'folder' | 'url'

/** Görevin yapılabileceği yer / araç (bkz. shared/context.ts) */
export type TaskContext = 'computer' | 'phone' | 'home' | 'campus' | 'online' | 'people'

/** Görevin gerektirdiği / günün enerjisi */
export type Energy = 'low' | 'medium' | 'high'


export interface Tag {
  id: number
  name: string
}

export interface Task {
  id: number
  title: string
  notes: string | null
  areaId: number | null
  status: TaskStatus
  priority: Priority
  deadline: string | null
  scheduledDate: string | null
  scheduledTime: string | null
  /** 'Bu hafta' olarak planlanan görevin haftasının pazartesi günü */
  plannedWeek: string | null
  estimateMin: number | null
  firstStep: string | null
  firstStepTarget: string | null
  firstStepType: FirstStepType | null
  /** Bu tarih için "Bugünün 3'ü" olarak işaretli */
  top3Date: string | null
  postponeCount: number
  parentId: number | null
  recurrenceId: number | null
  waitingFor: string | null
  followUpDate: string | null
  createdAt: string
  completedAt: string | null
  tags: Tag[]
  subtaskCount: number
  subtaskDoneCount: number
  /** Odak oturumlarından ölçülen toplam gerçek süre (dakika) */
  actualMin: number
  /** Ne kadar enerji ister; boşsa süreden tahmin edilir */
  energyLevel: Energy | null
  /** Nerede yapılabilir; boşsa her yerde */
  context: TaskContext | null
}

export interface TaskInput {
  title: string
  notes?: string | null
  areaId?: number | null
  status?: TaskStatus
  priority?: Priority
  deadline?: string | null
  scheduledDate?: string | null
  scheduledTime?: string | null
  plannedWeek?: string | null
  estimateMin?: number | null
  firstStep?: string | null
  firstStepTarget?: string | null
  firstStepType?: FirstStepType | null
  parentId?: number | null
  waitingFor?: string | null
  followUpDate?: string | null
  energyLevel?: Energy | null
  context?: TaskContext | null
  /** Verilirse görevin etiketleri tamamen bununla değiştirilir */
  tagIds?: number[]
}

export type TaskPatch = Partial<TaskInput>

export type TaskView =
  | 'inbox' // status = inbox, üst görevler
  | 'today' // bugüne planlı + tarihi geçmiş ve bitmemiş, saat sırasına göre
  | 'week' // bu haftaya planlı (tarihli veya plannedWeek)
  | 'later' // planned, tarihsiz, haftasız
  | 'waiting'
  | 'done'
  | 'all' // archived hariç
  | 'range' // from–to arasındaki tarihli görevler (planlayıcı), tamamlananlar dahil

export interface TaskFilter {
  view?: TaskView
  areaId?: number
  /** Sadece bu görevin alt görevleri. Verilmezse sadece üst görevler döner. */
  parentId?: number
  /** view = 'today' için gün (varsayılan bugün) */
  date?: string
  /** view = 'range' için tarih aralığı (dahil) */
  from?: string
  to?: string
}

/**
 * Inbox temizleme ve erteleme hedefi.
 * Tarihi olan bir görev daha ileri bir tarihe taşınırsa postponeCount artar.
 */
export type MoveTarget =
  | { to: 'today' }
  | { to: 'tomorrow' }
  | { to: 'thisWeek' }
  | { to: 'later' }
  | { to: 'inbox' }
  | { to: 'date'; date: string }

export type RecurrenceRule = 'daily' | 'weekdays' | 'weekly' | 'monthly'

export interface Recurrence {
  id: number
  title: string
  areaId: number | null
  estimateMin: number | null
  priority: Priority
  firstStep: string | null
  rule: RecurrenceRule
  /** weekly için: 1 = Pazartesi … 7 = Pazar */
  weekdays: number[]
  /** monthly için ayın günü (1–31; ayda o gün yoksa ayın son günü) */
  dayOfMonth: number | null
  time: string | null
  startDate: string
  endDate: string | null
  active: boolean
  isHabit?: boolean
  currentStreak?: number
  longestStreak?: number
}

export interface RecurrenceInput {
  title: string
  areaId?: number | null
  estimateMin?: number | null
  priority?: Priority
  firstStep?: string | null
  rule: RecurrenceRule
  weekdays?: number[]
  dayOfMonth?: number | null
  time?: string | null
  startDate?: string
  endDate?: string | null
  isHabit?: boolean
}

export type ThemeMode = 'dark' | 'light' | 'system'

export interface Settings {
  userName: string
  theme: ThemeMode
  /** Planlayıcının ve günün başlangıç / bitiş saati (SS:dd) */
  dayStart: string
  dayEnd: string
  /** Masaüstü bildirimleri */
  notifyEnabled: boolean
  /** Görev / ders başlamadan kaç dakika önce hatırlatılsın */
  notifyLeadMin: number
  /** Gün başında günün özeti */
  notifyMorning: boolean
  /** Pencere kapatılınca tepsiye küçül (bildirimler ve kısayol çalışmaya devam eder) */
  closeToTray: boolean
  /** Windows açılınca başlat */
  launchAtLogin: boolean
  /** Sabah planlama daveti ve akşam gün kapanışı hatırlatması */
  ritualsEnabled: boolean
  /** Pomodoro süreleri ve davranışı (bkz. shared/pomodoro.ts) */
  pomodoro: import('./pomodoro').PomodoroConfig
  /** Faz değişiminde zil sesi */
  pomodoroSound: boolean
  /** Varsayılandan farklı kısayollar: eylem → Electron accelerator ("Control+Shift+K"). Bkz. shared/keybindings.ts */
  keybindings: Partial<Record<string, string>>
}

export interface DayRitual {
  date: string
  morningDoneAt: string | null
  shutdownDoneAt: string | null
  /** Gün kapanışında "yarın için" yazılan tek satır */
  note: string | null
}

/** Yerel profil (şifre özeti renderer'a hiç gönderilmez) */
export interface MailAccount {
  id: number
  provider: import('./mail').MailProvider
  email: string
  host: string
  port: number
  /** Hangi e-postalar görev olur */
  rule: import('./mail').MailRule
  /** Görevlerin düşeceği alan */
  areaId: number | null
  enabled: boolean
  lastSyncedAt: string | null
  lastError: string | null
  /** Bu hesaptan şimdiye kadar oluşturulan görev */
  imported: number
}

export interface MailAccountInput {
  provider?: import('./mail').MailProvider
  email: string
  /** Uygulama şifresi (şifrelenip saklanır, bir daha okunamaz) */
  password: string
  /** Yalnızca "custom" sağlayıcıda */
  host?: string
  port?: number
  rule?: import('./mail').MailRule
  areaId?: number | null
}

export type MailAccountPatch = Partial<Pick<MailAccount, 'rule' | 'areaId' | 'enabled'>>

export interface LoginResult {
  ok: boolean
  error?: string
  /** Yanlış şifre bekleme süresi (sn) */
  retryInSec?: number
  profile?: ProfileInfo
}

export interface ProfileInfo {
  id: string
  name: string
  /** Giriş e-postası; eski profillerde null olabilir (o zaman adla girilir) */
  email: string | null
  /** 'area-1' … 'area-8' */
  color: string
  /** Şifre ipucu (isteğe bağlı) */
  hint: string | null
  createdAt: string
  lastLoginAt: string | null
  /** Açık oturum Google ile mi açıldı (yalnızca auth.current) */
  viaGoogle?: boolean
}

export interface BackupInfo {
  path: string
  name: string
  createdAt: string
  sizeBytes: number
}

export interface ShortcutStatus {
  quickAdd: string | null
  /** Kayıt edilemezse (başka uygulama kullanıyorsa) neden */
  error: string | null
}

export interface DayCapacity {
  /** 1 = Pazartesi … 7 = Pazar */
  weekday: number
  minutes: number
}

export interface ActiveSession {
  id: number
  taskId: number
  startedAt: string
}

export interface DaySummary {
  date: string
  /** Ders programı düşüldükten sonra kalan kapasite */
  capacityMin: number
  /** Ders programındaki meşgul süre */
  busyMin: number
  /** O güne planlı (ve geçmişten kalan) görevlerin tahmini toplamı */
  plannedMin: number
  /** Bunlardan bitmemiş olanların tahmini toplamı */
  remainingMin: number
  /** O gün odak oturumlarında geçen süre */
  actualMin: number
  /** "Bugün nasılsın?" cevabı */
  energy: Energy | null
  doneCount: number
  openCount: number
}

export interface AreaWeekStat {
  areaId: number | null
  plannedMin: number
  actualMin: number
  doneCount: number
}

export interface WeekStats {
  weekStart: string
  plannedMin: number
  actualMin: number
  doneCount: number
  postponedCount: number
  /** Gün gün odak süresi (dakika), pazartesiden pazara 7 eleman */
  focusByDay: number[]
  byArea: AreaWeekStat[]
  /** Tamamlanmış görevlerde gerçek / tahmin medyanı (en az 3 görev). Veri yoksa null. */
  estimateRatio: number | null
  /** Son 30 gündeki erteleme nedenleri, en sık önce */
  postponeReasons: { reason: string; count: number }[]
}

export interface IElectronAPI {
  auth: {
    /** Giriş ekranındaki profiller */
    profiles(): Promise<ProfileInfo[]>
    /** Giriş yapılmışsa açık profil */
    current(): Promise<ProfileInfo | null>
    /** Profiller gelmeden önceki veriler var mı (ilk profile taşınır) */
    hasLegacyData(): Promise<boolean>
    create(input: { name: string; email: string; password: string; hint?: string | null }): Promise<ProfileInfo>
    login(id: string, password: string): Promise<LoginResult>
    /** E-posta (ya da e-postası olmayan eski profillerde ad) + şifre */
    loginEmail(identifier: string, password: string): Promise<LoginResult>
    /** Google ile giriş (sistem tarayıcısında). Profil yoksa `google` alanında e-posta ve ad döner. */
    google(): Promise<LoginResult & { google?: { email: string; name: string | null } }>
    /** Google istemci kimliği tanımlı mı; değilse google-oauth.json nereye konmalı */
    googleSetup(): Promise<{ available: boolean; configPath: string }>
    /** "Şifremi unuttum": profilin şifre ipucu */
    hint(identifier: string): Promise<string | null>
    /** Kilitle: giriş ekranına döner */
    logout(): Promise<void>
    changePassword(oldPassword: string, newPassword: string, hint?: string | null): Promise<void>
    rename(name: string): Promise<ProfileInfo>
    setEmail(email: string): Promise<ProfileInfo>
    delete(id: string, password: string): Promise<void>
  }
  /** Giriş / çıkış olunca tetiklenir (null = giriş ekranı) */
  onAuthChanged(callback: (profile: ProfileInfo | null) => void): () => void

  areas: {
    list(): Promise<Area[]>
    create(input: AreaInput): Promise<Area>
    update(id: number, patch: Partial<AreaInput>): Promise<Area>
    /** Alanı siler; görevleri silinmez, alansız kalır */
    delete(id: number): Promise<void>
    /** Verilen sırayla sort_order yazar */
    reorder(ids: number[]): Promise<Area[]>
  }
  events: {
    list(): Promise<FixedEvent[]>
    /** weekdays verilirse her gün için ayrı kayıt oluşturur */
    create(input: Omit<FixedEventInput, 'weekday'> & { weekdays: number[] }): Promise<FixedEvent[]>
    update(id: number, patch: Partial<FixedEventInput>): Promise<FixedEvent>
    delete(id: number): Promise<void>
  }
  tasks: {
    list(filter?: TaskFilter): Promise<Task[]>
    get(id: number): Promise<Task | null>
    create(input: TaskInput): Promise<Task>
    update(id: number, patch: TaskPatch): Promise<Task>
    /** Alt görevleriyle birlikte kalıcı siler. Geri al için önce get() ile saklayın. */
    delete(id: number): Promise<void>
    complete(id: number): Promise<Task>
    uncomplete(id: number): Promise<Task>
    move(id: number, target: MoveTarget): Promise<Task>
    /** date için "Bugünün 3'ü" işaretini aç/kapat. Günde en fazla 3; dolu ise hata fırlatır. */
    setTop3(id: number, date: string | null): Promise<Task>
    /** FTS5 tam metin arama (Türkçe karakter duyarsız, kelime başı eşleşir). Tamamlananlar dahil. */
    search(query: string, limit?: number): Promise<Task[]>
    /** Son ertelemenin nedenini kaydeder (Analiz'de en sık sürtünme noktası olarak görünür) */
    setPostponeReason(id: number, reason: string): Promise<void>
    /** Alt görevleri tek seferde oluşturur; tarih verilirse o güne planlar */
    createSubtasks(parentId: number, steps: { title: string; estimateMin: number; scheduledDate: string | null }[]): Promise<Task[]>
    /** Bekliyor olarak işaretle: kimi/neyi bekliyorum + takip tarihi */
    setWaiting(id: number, waitingFor: string, followUpDate: string | null): Promise<Task>
    /** İlk adımın hedefini (dosya, klasör, URL) açar. Açılamazsa nedenini döner. */
    openFirstStep(id: number): Promise<{ ok: boolean; error?: string }>
  }
  tags: {
    list(): Promise<Tag[]>
    create(name: string): Promise<Tag>
  }
  recurrences: {
    list(): Promise<Recurrence[]>
    create(input: RecurrenceInput): Promise<Recurrence>
    update(id: number, patch: Partial<RecurrenceInput>): Promise<Recurrence>
    /** "Bu ve sonrakileri durdur": kuralı pasif yapar, mevcut görevlere dokunmaz */
    stop(id: number): Promise<Recurrence>
    resume(id: number): Promise<Recurrence>
    /** Kuralı siler; daha önce üretilmiş görevler kalır */
    delete(id: number): Promise<void>
  }
  settings: {
    get(): Promise<Settings>
    update(patch: Partial<Settings>): Promise<Settings>
  }
  capacity: {
    list(): Promise<DayCapacity[]>
    set(weekday: number, minutes: number): Promise<DayCapacity[]>
    /** Tek bir güne özel kapasite ("bugün sadece 2 saatim var"); null → haftanın günü varsayılanına dön */
    setOverride(date: string, minutes: number | null): Promise<void>
    /** O güne özel kapasite varsa dakika, yoksa null */
    override(date: string): Promise<number | null>
  }
  sessions: {
    active(): Promise<ActiveSession | null>
    /** Çalışan başka bir oturum varsa önce onu bitirir */
    start(taskId: number): Promise<ActiveSession>
    /** Aktif oturumu bitirir, süreyi (dakika) döner. Aktif oturum yoksa 0. */
    stop(): Promise<number>
  }
  stats: {
    /** Kişisel tahmin çarpanı (genel ve alan bazında) */
    estimation(): Promise<import('./estimation').EstimationProfile>
    /** "Bugün nasılsın?" */
    setEnergy(date: string, energy: Energy | null): Promise<void>
    day(date?: string): Promise<DaySummary>
    week(date?: string): Promise<WeekStats>
  }
  rituals: {
    get(date?: string): Promise<DayRitual>
    /** Önceki günlerden (en fazla 3) kalan "yarın için" notu */
    previousNote(date?: string): Promise<{ date: string; note: string } | null>
    completeMorning(date?: string): Promise<DayRitual>
    completeShutdown(date: string, note: string | null): Promise<DayRitual>
    reopen(date?: string): Promise<DayRitual>
  }
  notify: {
    /** Bildirimlerin çalıştığını görmek için örnek bildirim gönderir */
    test(): Promise<boolean>
    /** Masaüstü bildirimi (ör. Pomodoro faz değişimi); tıklanınca route açılır */
    show(title: string, body: string, route?: string): Promise<boolean>
  }
  /** Bildirime tıklanınca main, gidilecek sayfayı gönderir */
  onNavigate(callback: (route: string, taskId: number | null) => void): () => void
  ui: {
    /** Pencere düğmelerini (simge durumu, kapat) temaya uydurur */
    setTitleBar(dark: boolean): Promise<void>
  }
  data: {
    /** Kaydetme penceresi açar, tüm veriyi JSON yazar. İptal edilirse null. */
    exportJson(): Promise<string | null>
    /** JSON yedeği seçtirir ve mevcut verinin yerine koyar (önce otomatik yedek alır). İptal edilirse null. */
    importJson(): Promise<{ tasks: number } | null>
  }
  backups: {
    list(): Promise<BackupInfo[]>
    /** Hemen yedek alır */
    now(): Promise<BackupInfo>
    openFolder(): Promise<void>
    /** Seçilen yedeğe döner (önce mevcut verinin yedeğini alır) */
    restore(path: string): Promise<void>
  }
  files: {
    /** Dosya veya klasör seçtirir; iptal edilirse null */
    pick(kind: 'file' | 'folder'): Promise<string | null>
  }
  mail: {
    list(): Promise<MailAccount[]>
    /** Bağlantıyı dener, başarılıysa şifreli kaydeder */
    add(input: MailAccountInput): Promise<MailAccount>
    update(id: number, patch: MailAccountPatch): Promise<MailAccount>
    remove(id: number): Promise<void>
    /** Şimdi kontrol et (id yoksa tüm hesaplar) */
    sync(id?: number): Promise<{ added: number; errors: string[] }>
  }
  ai: {
    /** Gemini tabanlı anlamsal arama (Semantic Search) */
    semanticSearch(query: string): Promise<Task[]>
  }
  shortcuts: {
    status(): Promise<ShortcutStatus>
    /** Kısayol kaydedilirken global kısayolları geçici olarak kapatır (basılan tuş tetiklenmesin) */
    suspend(paused: boolean): Promise<ShortcutStatus>
  }
  quick: {
    /** Hızlı ekleme penceresini gizler */
    close(): Promise<void>
    /** Pencere her gösterildiğinde (kısayola basılınca) tetiklenir */
    onShown(callback: () => void): () => void
  }
  /** main tarafında veri değişince (ör. gece yarısı tekrar görevleri üretildi) tetiklenir. Abonelikten çıkış fonksiyonu döner. */
  onDataChanged(callback: () => void): () => void
}
